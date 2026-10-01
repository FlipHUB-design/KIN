import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, emailOn, isDemoEmail, sendEmail, site } from "@/lib/notify";
import { addDays, today } from "@/lib/kin";

// Morning email: today's jobs, anything waiting for an answer, and where the children sleep tonight.
// Vercel Cron calls this once a day with "Authorization: Bearer <CRON_SECRET>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pattern = { circle_id: string; anchor: string; days: string[] };
type Change = { circle_id: string; start_date: string; end_date: string; household_id: string; responded_at: string | null };

function homeOn(circle: string, date: string, patterns: Pattern[], changes: Change[]) {
  const ch = changes.filter((c) => c.circle_id === circle && date >= c.start_date && date <= c.end_date)
    .sort((a, b) => String(b.responded_at).localeCompare(String(a.responded_at)))[0];
  if (ch) return ch.household_id;
  const p = patterns.find((x) => x.circle_id === circle);
  if (!p?.days?.length) return null;
  const diff = Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(p.anchor + "T12:00:00Z")) / 86400000);
  return p.days[((diff % p.days.length) + p.days.length) % p.days.length];
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin || !emailOn()) return NextResponse.json({ sent: 0, reason: "email not set up" });
  const t = today(), y = addDays(t, -1);

  const { data: members } = await admin.from("memberships").select("circle_id, user_id, role, care_circles(person_name, preferred_name, kind)").eq("status", "active");
  if (!members?.length) return NextResponse.json({ sent: 0 });
  const circles = [...new Set(members.map((m) => m.circle_id))];
  const [{ data: prefs }, { data: tasks }, { data: changes }, { data: pending }, { data: proposals }, { data: patterns }, { data: accepted }, { data: homes }, { data: kids }] = await Promise.all([
    admin.from("notification_prefs").select("user_id, digest"),
    admin.from("tasks").select("circle_id, title, assignee, due_date, due_time").eq("status", "accepted").lte("due_date", t).not("assignee", "is", null),
    admin.from("schedule_changes").select("circle_id, requested_by").eq("status", "requested").in("circle_id", circles),
    admin.from("expenses").select("circle_id, created_by, split_between, description").eq("status", "pending").in("circle_id", circles),
    admin.from("agreements").select("circle_id, proposed_by, title").eq("status", "proposed").in("circle_id", circles),
    admin.from("schedule_patterns").select("circle_id, anchor, days").in("circle_id", circles),
    admin.from("schedule_changes").select("circle_id, start_date, end_date, household_id, responded_at").eq("status", "accepted").in("circle_id", circles).gte("end_date", y),
    admin.from("households").select("id, name").in("circle_id", circles),
    admin.from("children").select("circle_id, first_name").in("circle_id", circles).order("sort"),
  ]);

  const byUser = new Map<string, typeof members>();
  for (const m of members) byUser.set(m.user_id, [...(byUser.get(m.user_id) || []), m]);
  let sent = 0;
  for (const [userId, mine] of byUser) {
    if (prefs?.find((p) => p.user_id === userId)?.digest === false) continue;
    const sections: string[][] = [];
    const heads: string[] = [];
    for (const m of mine) {
      const c = m.care_circles as unknown as { person_name: string; preferred_name: string; kind: string } | null;
      if (!c) continue;
      const parent = m.role === "admin" || m.role === "family";
      const lines: string[] = [];
      let handoverToday = false;
      if (c.kind === "children") {
        const tonight = homeOn(m.circle_id, t, (patterns || []) as Pattern[], (accepted || []) as Change[]);
        const last = homeOn(m.circle_id, y, (patterns || []) as Pattern[], (accepted || []) as Change[]);
        const names = (kids || []).filter((k) => k.circle_id === m.circle_id).map((k) => k.first_name);
        const who = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0] || "The children";
        const home = homes?.find((h) => h.id === tonight)?.name;
        if (home) { handoverToday = !!last && last !== tonight; lines.push(`Tonight: ${who} ${names.length === 1 ? "is" : "are"} at ${home}${handoverToday ? " (handover day)" : ""}.`); }
      }
      const due = (tasks || []).filter((x) => x.circle_id === m.circle_id && x.assignee === userId);
      for (const x of due.slice(0, 6)) lines.push(`${x.due_date! < t ? "Overdue" : x.due_time ? `Today ${String(x.due_time).slice(0, 5)}` : "Today"}: ${x.title}`);
      let waiting = 0;
      if (parent) {
        waiting += (changes || []).filter((x) => x.circle_id === m.circle_id && x.requested_by !== userId).length;
        waiting += (pending || []).filter((x) => x.circle_id === m.circle_id && x.created_by !== userId && (x.split_between as string[]).includes(userId)).length;
        waiting += (proposals || []).filter((x) => x.circle_id === m.circle_id && x.proposed_by !== userId).length;
        if (waiting) lines.push(`${waiting === 1 ? "1 thing is" : `${waiting} things are`} waiting for your answer.`);
      }
      if (!due.length && !waiting && !handoverToday) continue;
      heads.push(c.kind === "children" ? c.person_name : `${c.preferred_name}'s Care Circle`);
      sections.push([c.kind === "children" ? c.person_name : `${c.preferred_name}'s Care Circle`, ...lines]);
    }
    if (!sections.length) continue;
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u.user?.email;
    if (!email || isDemoEmail(email)) continue;
    const lines = sections.flatMap((s) => (sections.length > 1 ? [s[0].toUpperCase(), ...s.slice(1)] : s.slice(1)));
    const ok = await sendEmail(email, `Today in KIN: ${heads.join(", ")}`,
      emailHtml({ heading: "Your day in KIN", lines, button: { label: "Open KIN", href: `${site()}/circles` },
        footer: `Turn off the morning email at ${site()}/account/alerts` }),
      `Your day in KIN\n\n${lines.join("\n")}\n\n${site()}/circles\n\nTurn off the morning email: ${site()}/account/alerts`);
    if (ok) sent++;
  }
  return NextResponse.json({ sent });
}
