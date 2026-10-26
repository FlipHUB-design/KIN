import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { longDate, money } from "@/lib/kin";
import { Notice } from "@/components/ui";
import Thread from "@/components/Thread";

const BACK: Record<string, [string, string]> = { change: ["/schedule", "Schedule"], agreement: ["/agreements", "Agreements"], expense: ["/costs", "Costs"] };

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ circle: string; type: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, type, id } = await params;
  const sp = await searchParams;
  if (!(type in BACK) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, nameOf, role } = await getCircle(cid);
  let title = "", sub = "";
  if (type === "change") {
    const { data: r } = await supabase.from("schedule_changes").select("*, households(name)").eq("id", id).eq("circle_id", cid).maybeSingle();
    if (!r) notFound();
    title = `${r.label ? r.label + ": " : ""}${longDate(r.start_date)}${r.end_date !== r.start_date ? ` to ${longDate(r.end_date)}` : ""} at ${(r.households as { name: string } | null)?.name || "the other home"}`;
    sub = `Asked by ${nameOf(r.requested_by)}${r.reason ? ` · “${r.reason}”` : ""} · ${({ requested: "Waiting for an answer", accepted: "Agreed", declined: "Not agreed", cancelled: "Withdrawn" } as Record<string, string>)[r.status]}`;
  } else if (type === "agreement") {
    const { data: g } = await supabase.from("agreements").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
    if (!g) notFound();
    title = g.title; sub = `${g.status === "agreed" ? "Agreed" : g.status === "proposed" ? "Proposed" : g.status === "declined" ? "Not agreed" : "Withdrawn"} · proposed by ${nameOf(g.proposed_by)}${g.detail ? ` · ${g.detail}` : ""}`;
  } else {
    const { data: e } = await supabase.from("expenses").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
    if (!e) notFound();
    title = `${e.description} · ${money(e.amount_pence)}`; sub = `Paid by ${nameOf(e.paid_by)} on ${longDate(e.spent_on)}${e.status && e.status !== "approved" ? ` · ${e.status === "pending" ? "Waiting for approval" : "Queried"}` : ""}`;
  }
  const [path, label] = BACK[type];
  return (
    <main className="page">
      <Link href={`/c/${cid}${path}`} className="link">‹ {label}</Link>
      <Notice sp={sp} />
      <h1>{title}</h1>
      <p className="muted">{sub}</p>
      <Thread supabase={supabase} circleId={cid} type={type as "change"} subjectId={id} nameOf={nameOf} canPost={role !== "helper"} title="Discussion"
        empty="No messages yet. Keep it short and about the arrangement; both of you can see it, and it's kept with the record."
        placeholder="e.g. Could we make the handover 6pm instead?" />
    </main>
  );
}
