import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today } from "@/lib/kin";
import { homeOn, type Change, type Pattern } from "@/lib/support";
import type { KidDay } from "@/components/KidWeek";

const FAMILY = /^(mum|mom|mummy|dad|daddy|grandma|grandad|grandpa|granny|gran|nan|nana|nanny|grandmother|grandfather|auntie|aunty|aunt|uncle|step-?mum|step-?dad)$/i;
/** "5:30pm" rather than "17:30", for children. */
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`; };

/**
 * One child's next `n` days: where they sleep, who collects them, and what's on.
 * Works with a signed-in client (row rules apply) or the server client for a tablet link.
 * Only events and jobs that aren't private, and that are for this child, are shown.
 */
export async function kidWeek(db: SupabaseClient, circleId: string, childId: string, n = 7, nameOf?: (id: string | null) => string): Promise<KidDay[]> {
  const t = today(), to = addDays(t, n - 1);
  const [{ data: homes }, { data: pattern }, { data: changes }, { data: tasks }, { data: events }] = await Promise.all([
    db.from("households").select("id, name, colour").eq("circle_id", circleId),
    db.from("schedule_patterns").select("anchor, days").eq("circle_id", circleId).maybeSingle(),
    db.from("schedule_changes").select("start_date, end_date, household_id, responded_at").eq("circle_id", circleId).eq("status", "accepted").gte("end_date", t),
    db.from("tasks").select("title, category, due_date, due_time, assignee, recurrence").eq("circle_id", circleId).eq("private", false).in("status", ["open", "accepted"]).contains("child_ids", [childId]).not("due_date", "is", null).lte("due_date", to),
    db.from("appointments").select("title, date, end_date, time").eq("circle_id", circleId).eq("private", false).contains("child_ids", [childId]).lte("date", to).gte("date", addDays(t, -30)),
  ]);
  // Signed in: use the nights() function, which respects each role. Tablet link: work it out here.
  const viaRpc = nameOf ? ((await db.rpc("nights", { c: circleId, from_date: t, to_date: to })).data || []) as { night: string; household_id: string | null }[] : null;
  // Children see "Dad" or "Grandma" rather than a first name, where the family has said how people are related
  const ids = [...new Set((tasks || []).map((x) => x.assignee).filter(Boolean))] as string[];
  const [{ data: profs }, { data: rels }] = ids.length ? await Promise.all([
    db.from("profiles").select("id, display_name").in("id", ids),
    db.from("memberships").select("user_id, relationship").eq("circle_id", circleId).in("user_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const names = (id: string | null) => {
    const rel = (rels || []).find((r) => r.user_id === id)?.relationship as string | undefined;
    if (rel && FAMILY.test(rel.trim())) return rel.trim().replace(/^./, (c) => c.toUpperCase());
    const first = (profs || []).find((p) => p.id === id)?.display_name?.split(" ")[0];
    return first || (nameOf && nameOf(id) !== "You" ? nameOf(id) : "Someone");
  };
  const out: KidDay[] = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(t, i);
    const hid = viaRpc ? viaRpc.find((x) => String(x.night).slice(0, 10) === d)?.household_id ?? null : homeOn(d, pattern as Pattern | null, (changes || []) as Change[]);
    const h = (homes || []).find((x) => x.id === hid);
    const lines: string[] = [];
    for (const x of tasks || []) {
      const step = { daily: 1, weekly: 7, fortnightly: 14 }[x.recurrence as string];
      const on = x.due_date === d || (step && x.due_date! <= d && (Math.round((Date.parse(d) - Date.parse(x.due_date!)) / 86400000) % step === 0));
      if (!on) continue;
      if (x.category === "Pick-up or drop-off") lines.push(`${x.assignee ? names(x.assignee) : "Someone"} ${/drop/i.test(x.title) ? "drops you off" : "picks you up"}${x.due_time ? ` at ${clock(x.due_time)}` : ""}`);
      else if (x.category === "Club or activity") lines.push(`${x.title}${x.due_time ? ` at ${clock(x.due_time)}` : ""}`);
    }
    for (const e of events || []) if (e.date <= d && (e.end_date || e.date) >= d) lines.push(`${e.title}${e.time && e.date === d ? ` at ${clock(e.time)}` : ""}`);
    out.push({ date: d, home: h?.name || null, colour: h?.colour || null, lines: lines.slice(0, 4) });
  }
  return out;
}
