import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { money, type Agreement, type Expense, type Handover, type Household, type ScheduleChange, type Settlement } from "@/lib/kin";

export type Record_ = { at: string; type: "Schedule" | "Cost" | "Payment" | "Maintenance" | "Agreement" | "Handover"; who: string; text: string; status?: string };
export const RECORD_TYPES = ["Schedule", "Cost", "Payment", "Maintenance", "Agreement", "Handover"] as const;

/** Everything the viewer may see, newest first. Each entry keeps the time it was made and who made it. */
export async function buildRecords(supabase: SupabaseClient, circleId: string, nameOf: (id: string | null) => string) {
  const [ch, ex, st, ag, ho, hh] = await Promise.all([
    supabase.from("schedule_changes").select("*").eq("circle_id", circleId),
    supabase.from("expenses").select("*").eq("circle_id", circleId),
    supabase.from("settlements").select("*").eq("circle_id", circleId),
    supabase.from("agreements").select("*").eq("circle_id", circleId),
    supabase.from("handovers").select("*").eq("circle_id", circleId),
    supabase.from("households").select("*").eq("circle_id", circleId),
  ]);
  const homes = (hh.data || []) as Household[];
  const home = (id: string | null) => homes.find((h) => h.id === id)?.name || "?";
  const nm = (id: string | null) => (nameOf(id) === "You" ? "You" : nameOf(id));
  const d = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const out: Record_[] = [];
  for (const c of (ch.data || []) as ScheduleChange[]) {
    const r = c.start_date === c.end_date ? d(c.start_date) : `${d(c.start_date)} to ${d(c.end_date)}`;
    out.push({ at: c.requested_at, type: "Schedule", who: nm(c.requested_by), text: `Asked for ${r} at ${home(c.household_id)}${c.reason ? `. Reason: ${c.reason}` : ""}${c.in_return ? `. In return: ${c.in_return}` : ""}` });
    if (c.responded_at && c.status !== "requested") out.push({ at: c.responded_at, type: "Schedule", who: nm(c.status === "cancelled" ? c.requested_by : c.responded_by),
      text: `${{ accepted: "Agreed", declined: "Did not agree to", cancelled: "Withdrew", requested: "" }[c.status]} the request for ${r}${c.response_note ? `. Note: ${c.response_note}` : ""}`, status: c.status });
  }
  for (const e of (ex.data || []) as Expense[]) {
    out.push({ at: (e as unknown as { created_at: string }).created_at, type: "Cost", who: nm(e.created_by), text: `${e.description}, ${money(e.amount_pence)} paid by ${nm(e.paid_by)} on ${d(e.spent_on)}${e.shares ? ` (split ${Object.entries(e.shares).map(([k, v]) => `${nm(k)} ${v}`).join(" / ")})` : ""}`, status: e.status });
    if (e.responded_at) out.push({ at: e.responded_at, type: "Cost", who: nm(e.responded_by || null), text: `${e.status === "approved" ? "Approved" : "Queried"} ${e.description}, ${money(e.amount_pence)}${e.response_note ? `. Note: ${e.response_note}` : ""}`, status: e.status });
  }
  for (const s of (st.data || []) as (Settlement & { created_at: string })[]) {
    out.push({ at: s.created_at, type: s.kind === "maintenance" ? "Maintenance" : "Payment", who: nm(s.created_by), text: `${nm(s.from_user)} paid ${nm(s.to_user)} ${money(s.amount_pence)} on ${d(s.paid_on)}${s.note ? ` (${s.note})` : ""}` });
  }
  for (const a of (ag.data || []) as Agreement[]) {
    out.push({ at: a.proposed_at, type: "Agreement", who: nm(a.proposed_by), text: `Proposed: ${a.title}${a.detail ? `. ${a.detail}` : ""}` });
    if (a.decided_at) out.push({ at: a.decided_at, type: "Agreement", who: nm(a.status === "withdrawn" ? null : a.decided_by), text: `${{ agreed: "Agreed", declined: "Did not agree", withdrawn: "Withdrawn", proposed: "" }[a.status]}: ${a.title}${a.note ? `. Note: ${a.note}` : ""}`, status: a.status });
  }
  for (const h of (ho.data || []) as Handover[]) {
    out.push({ at: h.handed_at, type: "Handover", who: nm(h.recorded_by), text: `${home(h.from_household)} to ${home(h.to_household)}${h.items_missing.length ? `. Missing: ${h.items_missing.join(", ")}` : ". Nothing missing"}${h.note ? `. Note: ${h.note}` : ""}` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
