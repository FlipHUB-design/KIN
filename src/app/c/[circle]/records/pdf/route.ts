import { NextResponse, type NextRequest } from "next/server";
import { getCircle } from "@/lib/data";
import { addDays, canEdit, money, today, TZ, type Agreement, type Expense, type Household, type ScheduleChange, type Settlement } from "@/lib/kin";
import { buildRecords } from "@/lib/records";
import { makeReport, type ReportBlock } from "@/lib/report";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const d = (s: string) => new Date(s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const ukDay = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));

/** A plain summary of agreements, swaps and costs over a chosen period, for a mediator or solicitor. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, role, nameOf, circle, user } = await getCircle(id);
  if (!canEdit(role) || circle.kind !== "children") return new NextResponse("Not found", { status: 404 });

  const q = req.nextUrl.searchParams;
  let to = q.get("to") || today(), from = q.get("from") || addDays(to, -180);
  if (!ISO.test(from) || !ISO.test(to)) return new NextResponse("Dates must be YYYY-MM-DD", { status: 400 });
  if (from > to) [from, to] = [to, from];
  const inRange = (s: string | null | undefined) => !!s && s.slice(0, 10) >= from && s.slice(0, 10) <= to;
  const tsInRange = (s: string | null | undefined) => !!s && inRange(ukDay(s));

  const me = (await supabase.from("profiles").select("display_name").eq("id", user.id).single()).data?.display_name || "Me";
  const name = (uid: string | null) => { const n = nameOf(uid); return n === "You" ? me : n; };

  const [ag, ch, ex, st, hh, kids] = await Promise.all([
    supabase.from("agreements").select("*").eq("circle_id", id).order("proposed_at"),
    supabase.from("schedule_changes").select("*").eq("circle_id", id).order("start_date"),
    supabase.from("expenses").select("*").eq("circle_id", id).order("spent_on"),
    supabase.from("settlements").select("*").eq("circle_id", id).order("paid_on"),
    supabase.from("households").select("*").eq("circle_id", id),
    supabase.from("children").select("first_name").eq("circle_id", id),
  ]);
  const homes = (hh.data || []) as Household[];
  const home = (h: string | null) => homes.find((x) => x.id === h)?.name || "?";

  const blocks: ReportBlock[] = [];
  const W3 = [18, 52, 30], W4 = [16, 44, 22, 18];

  // 1. Agreements in force at the end of the period, and any decided during it
  const agreements = (ag.data || []) as Agreement[];
  const inForce = agreements.filter((a) => a.status === "agreed" && a.decided_at && ukDay(a.decided_at) <= to);
  const decided = agreements.filter((a) => tsInRange(a.decided_at) && a.status !== "agreed");
  const proposedOpen = agreements.filter((a) => a.status === "proposed" && ukDay(a.proposed_at) <= to);
  blocks.push({ type: "heading", text: "Agreements" });
  if (!inForce.length && !decided.length && !proposedOpen.length) blocks.push({ type: "para", text: "No agreements recorded.", muted: true });
  else {
    blocks.push({ type: "row", cells: ["Agreed on", "Agreement", "Proposed by / agreed by"], widths: W3, bold: true });
    for (const a of inForce) blocks.push({ type: "row", cells: [d(a.decided_at!), `${a.title}${a.detail ? `. ${a.detail}` : ""}${a.note ? ` (Note: ${a.note})` : ""}`, `${name(a.proposed_by)} / ${name(a.decided_by)}`], widths: W3 });
    for (const a of decided) blocks.push({ type: "row", cells: [d(a.decided_at!), `${a.status === "declined" ? "Not agreed" : "Withdrawn"}: ${a.title}${a.note ? ` (Note: ${a.note})` : ""}`, `${name(a.proposed_by)} / ${a.status === "withdrawn" ? "-" : name(a.decided_by)}`], widths: W3 });
    for (const a of proposedOpen) blocks.push({ type: "row", cells: [d(a.proposed_at), `Still awaiting an answer: ${a.title}`, name(a.proposed_by)], widths: W3 });
  }

  // 2. Schedule changes asked for or affecting nights in the period
  const changes = ((ch.data || []) as (ScheduleChange & { label?: string | null })[])
    .filter((c) => tsInRange(c.requested_at) || (c.start_date <= to && c.end_date >= from));
  const count = (s: string) => changes.filter((c) => c.status === s).length;
  blocks.push({ type: "heading", text: "Schedule changes and swaps" });
  if (!changes.length) blocks.push({ type: "para", text: "No changes to the usual arrangement in this period.", muted: true });
  else {
    blocks.push({ type: "para", text: `${changes.length} request${changes.length === 1 ? "" : "s"}: ${count("accepted")} agreed, ${count("declined")} not agreed, ${count("cancelled")} withdrawn, ${count("requested")} awaiting an answer.`, muted: true });
    blocks.push({ type: "row", cells: ["Nights", "Request", "Asked by", "Outcome"], widths: W4, bold: true });
    for (const c of changes) {
      const nights = c.start_date === c.end_date ? d(c.start_date) : `${d(c.start_date)} to ${d(c.end_date)}`;
      const what = `${c.label ? `${c.label}: ` : ""}at ${home(c.household_id)}${c.reason ? `. Reason: ${c.reason}` : ""}${c.in_return ? `. In return: ${c.in_return}` : ""}`;
      const outcome = { accepted: "Agreed", declined: "Not agreed", cancelled: "Withdrawn", requested: "Awaiting" }[c.status]
        + (c.responded_at && c.status !== "requested" ? ` ${d(c.responded_at)}` : "") + (c.response_note ? `. ${c.response_note}` : "");
      blocks.push({ type: "row", cells: [nights, what, `${name(c.requested_by)}, ${d(c.requested_at)}`, outcome], widths: W4 });
    }
  }

  // 3. Costs in the period, with totals
  const costs = ((ex.data || []) as Expense[]).filter((e) => inRange(e.spent_on));
  blocks.push({ type: "heading", text: "Shared costs" });
  if (!costs.length) blocks.push({ type: "para", text: "No shared costs recorded in this period.", muted: true });
  else {
    blocks.push({ type: "row", cells: ["Date", "Cost", "Paid by", "Amount / status"], widths: W4, bold: true });
    for (const e of costs) blocks.push({ type: "row", cells: [d(e.spent_on), `${e.description} (${e.category})${e.response_note ? `. Note: ${e.response_note}` : ""}`, name(e.paid_by),
      `${money(e.amount_pence)} · ${{ approved: "Approved", disputed: "Queried", pending: "Awaiting" }[e.status || "approved"]}`], widths: W4 });
    const total = costs.reduce((n, e) => n + e.amount_pence, 0);
    const byPayer = new Map<string, number>();
    for (const e of costs) byPayer.set(e.paid_by, (byPayer.get(e.paid_by) || 0) + e.amount_pence);
    const queried = costs.filter((e) => e.status === "disputed").reduce((n, e) => n + e.amount_pence, 0);
    blocks.push({ type: "space", h: 6 });
    blocks.push({ type: "para", text: `Total ${money(total)}. Paid by: ${[...byPayer].map(([p, v]) => `${name(p)} ${money(v)}`).join(", ")}.${queried ? ` Of this, ${money(queried)} has been queried.` : ""}` });
  }

  // 4. Payments and maintenance
  const pays = ((st.data || []) as Settlement[]).filter((s) => inRange(s.paid_on));
  blocks.push({ type: "heading", text: "Payments between parents" });
  if (!pays.length) blocks.push({ type: "para", text: "No payments recorded in this period.", muted: true });
  else {
    blocks.push({ type: "row", cells: ["Date", "Payment", "Type", "Amount"], widths: W4, bold: true });
    for (const s of pays) blocks.push({ type: "row", cells: [d(s.paid_on), `${name(s.from_user)} to ${name(s.to_user)}${s.note ? ` (${s.note})` : ""}`, s.kind === "maintenance" ? "Maintenance" : "Settling up", money(s.amount_pence)], widths: W4 });
    const maint = pays.filter((s) => s.kind === "maintenance").reduce((n, s) => n + s.amount_pence, 0);
    if (maint) blocks.push({ type: "para", text: `Maintenance recorded in this period: ${money(maint)}.` });
  }

  // 5. Handovers, then the full dated log
  const log = (await buildRecords(supabase, id, nameOf)).filter((r) => tsInRange(r.at)).reverse();
  const handovers = log.filter((r) => r.type === "Handover");
  blocks.push({ type: "heading", text: "Handovers" });
  blocks.push({ type: "para", text: handovers.length ? `${handovers.length} handover${handovers.length === 1 ? "" : "s"} recorded, ${handovers.filter((h) => h.text.includes("Missing:")).length} with something missing. Details are in the log below.` : "No handovers recorded in this period.", muted: true });

  blocks.push({ type: "heading", text: "Full dated log" });
  const stamp = (s: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(s));
  if (!log.length) blocks.push({ type: "para", text: "Nothing recorded in this period.", muted: true });
  else {
    blocks.push({ type: "row", cells: ["When (UK)", "Who", "What"], widths: [17, 15, 68], bold: true });
    for (const r of log) blocks.push({ type: "row", cells: [stamp(r.at), r.who === "You" ? me : r.who, `${r.type}: ${r.text}`], widths: [17, 15, 68] });
  }

  const childNames = (kids.data || []).map((k) => k.first_name as string);
  const subtitle = `${childNames.length ? `For ${childNames.join(", ").replace(/, ([^,]*)$/, " and $1")}. ` : ""}Period ${d(from)} to ${d(to)}. Produced by ${me} on ${d(today())}. Every entry was recorded in KIN at the time, with who made it; entries cannot be edited after they are answered.`;
  const pdf = makeReport(`${circle.person_name}: summary of arrangements`, subtitle, blocks, "KIN summary. A factual record, not legal advice.");

  await supabase.from("audit_log").insert({ circle_id: id, actor: user.id, action: "records.pdf", detail: { from, to } });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="kin-summary-${from}-to-${to}.pdf"`,
    },
  });
}
