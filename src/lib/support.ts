import { addDays, today, type Checkin, type Task } from "@/lib/kin";

// ---------------------------------------------------------------- repeating tasks
const dayNum = (s: string) => Math.round(Date.parse(s + "T12:00:00Z") / 86400000);
const addMonths = (s: string, n: number) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
};

/** Dates on which a task falls between from and to (inclusive), following its repeat. */
export function occurrences(t: Pick<Task, "due_date" | "recurrence">, from: string, to: string): string[] {
  if (!t.due_date) return [];
  const out: string[] = [];
  const step = { daily: 1, weekly: 7, fortnightly: 14 }[t.recurrence as string];
  if (step) {
    let d = t.due_date;
    if (d < from) { const skip = Math.ceil((dayNum(from) - dayNum(d)) / step); d = addDays(d, skip * step); }
    for (; d <= to; d = addDays(d, step)) out.push(d);
    return out;
  }
  if (t.recurrence === "monthly" || t.recurrence === "annually") {
    const n = t.recurrence === "monthly" ? 1 : 12;
    for (let i = 0, d = t.due_date; d <= to && i < 60; i++, d = addMonths(t.due_date, i * n)) if (d >= from) out.push(d);
    return out;
  }
  return t.due_date >= from && t.due_date <= to ? [t.due_date] : [];
}

// ---------------------------------------------------------------- care rota
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const weekdayOf = (s: string) => (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7;
export const VISIT_CATEGORIES = ["Visit"];

export type RotaDay = { date: string; needed: boolean; cover: { who: string | null; title: string; taskId?: string }[]; checkedIn: string[] };

/** Who is visiting or calling on each of the next `days` days, and which needed days have nobody. */
export function rota(opts: { visitDays: number[]; tasks: Task[]; checkins: Checkin[]; from?: string; days?: number }): RotaDay[] {
  const from = opts.from || today(), n = opts.days || 14, to = addDays(from, n - 1);
  const visits = opts.tasks.filter((t) => VISIT_CATEGORIES.includes(t.category) && (t.status === "accepted" || t.status === "open"));
  const out: RotaDay[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(from, i);
    const cover = visits.filter((t) => t.assignee && occurrences(t, from, to).includes(date)).map((t) => ({ who: t.assignee, title: t.title, taskId: t.id }));
    const checkedIn = [...new Set(opts.checkins.filter((c) => c.checked_in_at.slice(0, 10) === date).map((c) => c.user_id))];
    out.push({ date, needed: opts.visitDays.includes(weekdayOf(date)), cover, checkedIn });
  }
  return out;
}
export const gaps = (days: RotaDay[]) => days.filter((d) => d.needed && !d.cover.length && !d.checkedIn.length);

// ---------------------------------------------------------------- wellbeing
export const MOODS = [
  { key: "good", label: "Good", colour: "accent" },
  { key: "ok", label: "OK", colour: "amber" },
  { key: "not_great", label: "Not great", colour: "coral" },
] as const;
export type MoodKey = (typeof MOODS)[number]["key"];
export const moodKey = (label: string): MoodKey | null => MOODS.find((m) => m.label.toLowerCase() === label.trim().toLowerCase())?.key || null;
export const moodLabel = (k: string) => MOODS.find((m) => m.key === k)?.label || k;

// ---------------------------------------------------------------- where the children sleep
export type Pattern = { circle_id?: string; anchor: string; days: string[] };
export type Change = { start_date: string; end_date: string; household_id: string; responded_at: string | null };
/** The home for one night: the latest agreed change covering it, else the regular pattern. */
export function homeOn(date: string, pattern: Pattern | null | undefined, changes: Change[]) {
  const ch = changes.filter((c) => date >= c.start_date && date <= c.end_date)
    .sort((a, b) => String(b.responded_at).localeCompare(String(a.responded_at)))[0];
  if (ch) return ch.household_id;
  if (!pattern?.days?.length) return null;
  const diff = dayNum(date) - dayNum(pattern.anchor);
  return pattern.days[((diff % pattern.days.length) + pattern.days.length) % pattern.days.length];
}

// ---------------------------------------------------------------- special days
/** Easter Sunday (Gregorian), as YYYY-MM-DD. */
export function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
const nthSunday = (y: number, month: number, n: number) => {
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
  return `${y}-${String(month).padStart(2, "0")}-${String(1 + ((7 - first) % 7) + (n - 1) * 7).padStart(2, "0")}`;
};

export type SpecialDay = { key: string; title: string; start: string; end: string; kind: "holiday" | "birthday" | "family" | "school" };

/** Christmas, New Year, Easter, Mother's and Father's Day and birthdays in the next 12 months. */
export function specialDays(children: { first_name: string; date_of_birth: string | null }[], from = today()): SpecialDay[] {
  const to = addDays(from, 366);
  const y0 = Number(from.slice(0, 4));
  const out: SpecialDay[] = [];
  for (const y of [y0, y0 + 1]) {
    const e = easter(y);
    out.push(
      { key: `xmas-eve-${y}`, title: "Christmas Eve", start: `${y}-12-24`, end: `${y}-12-24`, kind: "holiday" },
      { key: `xmas-${y}`, title: "Christmas Day", start: `${y}-12-25`, end: `${y}-12-25`, kind: "holiday" },
      { key: `boxing-${y}`, title: "Boxing Day", start: `${y}-12-26`, end: `${y}-12-26`, kind: "holiday" },
      { key: `nye-${y}`, title: "New Year's Eve", start: `${y}-12-31`, end: `${y}-12-31`, kind: "holiday" },
      { key: `easter-${y}`, title: "Easter weekend", start: addDays(e, -2), end: addDays(e, 1), kind: "holiday" },
      { key: `mothers-${y}`, title: "Mother's Day", start: addDays(e, -21), end: addDays(e, -21), kind: "family" },
      { key: `fathers-${y}`, title: "Father's Day", start: nthSunday(y, 6, 3), end: nthSunday(y, 6, 3), kind: "family" },
    );
    for (const c of children) if (c.date_of_birth) {
      const d = `${y}${c.date_of_birth.slice(4)}`;
      out.push({ key: `bday-${c.first_name}-${y}`, title: `${c.first_name}'s birthday`, start: d, end: d, kind: "birthday" });
    }
  }
  return out.filter((d) => d.end >= from && d.start <= to).sort((a, b) => a.start.localeCompare(b.start));
}
