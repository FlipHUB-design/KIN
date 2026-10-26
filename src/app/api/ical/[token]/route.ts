import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/kin";
import { site } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Row = { kind: string; id: string; circle_name: string; title: string; starts: string; ends: string | null; at_time: string | null; location: string | null; detail: string | null };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (s: string) => s.replace(/-/g, "");
/** Lines longer than 75 characters continue on the next line after a space (RFC 5545). */
const fold = (l: string) => { const out: string[] = []; for (let i = 0; i < l.length; i += i ? 74 : 75) out.push((i ? " " : "") + l.slice(i, i + (i ? 74 : 75))); return out.join("\r\n"); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

const LONDON = [
  "BEGIN:VTIMEZONE", "TZID:Europe/London",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100", "TZNAME:BST", "DTSTART:19700329T010000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000", "TZNAME:GMT", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

/** A private calendar feed (iCalendar) for one person: what their role in each circle lets them see. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{32,80}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  if (!admin) return new NextResponse("Calendar feeds aren't set up on this server", { status: 503 });
  const { data, error } = await admin.rpc("calendar_feed", { p_token: token });
  if (error) return new NextResponse("Not found", { status: 404 });
  const rows = (data || []) as Row[];

  const now = stamp();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KIN//Family calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:KIN", "X-WR-TIMEZONE:Europe/London", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H", ...LONDON];
  for (const r of rows) {
    const summary = r.kind === "task" ? `${r.title} (${r.circle_name})` : `${r.circle_name}: ${r.title}`;
    lines.push("BEGIN:VEVENT", `UID:${r.kind}-${r.id}@kin`, `DTSTAMP:${now}`, `SUMMARY:${esc(summary)}`);
    if (r.at_time) {
      const t = r.at_time.slice(0, 5).replace(":", "") + "00";
      const [h, m] = r.at_time.split(":").map(Number);
      const endH = Math.min(h + 1, 23), endM = h + 1 > 23 ? 59 : m;
      lines.push(`DTSTART;TZID=Europe/London:${ymd(r.starts)}T${t}`,
        `DTEND;TZID=Europe/London:${ymd(r.ends && r.ends > r.starts ? r.ends : r.starts)}T${String(endH).padStart(2, "0")}${String(endM).padStart(2, "0")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(r.starts)}`, `DTEND;VALUE=DATE:${ymd(addDays(r.ends && r.ends > r.starts ? r.ends : r.starts, 1))}`);
    }
    if (r.location) lines.push(`LOCATION:${esc(r.location)}`);
    const desc = [r.detail, r.kind === "task" ? "A job you said you'd do in KIN." : null, "Open in KIN for details and updates."].filter(Boolean).join("\n");
    lines.push(`DESCRIPTION:${esc(desc)}`, `URL:${site()}/circles`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new NextResponse(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "content-disposition": 'inline; filename="kin.ics"' },
  });
}
