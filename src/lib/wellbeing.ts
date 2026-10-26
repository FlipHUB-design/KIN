import { addDays, dateOf, today } from "@/lib/kin";
import { weekdayOf, type MoodKey } from "@/lib/support";

export type Entry = { mood: MoodKey; note: string | null; created_at: string; user_id: string | null };

/** The last answer each day, the last `weeks` weeks laid out Monday to Sunday, and a two-week comparison. */
export function trend(entries: Entry[], weeks = 8) {
  const t = today();
  const byDay = new Map<string, Entry>();
  for (const e of [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))) byDay.set(dateOf(e.created_at), e);
  const start = addDays(t, -(weeks * 7 - 1) - weekdayOf(addDays(t, -(weeks * 7 - 1))));
  const cells: { date: string; mood: MoodKey | null; future: boolean }[] = [];
  for (let d = start; cells.length < weeks * 7 + 7 && (d <= t || weekdayOf(d) !== 0); d = addDays(d, 1)) cells.push({ date: d, mood: byDay.get(d)?.mood || null, future: d > t });
  // Don't show empty weeks before the first answer (keep at least two weeks)
  while (cells.length > 14 && cells.slice(0, 7).every((c) => !c.mood)) cells.splice(0, 7);
  const count = (from: string, to: string, m: MoodKey) => [...byDay.entries()].filter(([d, e]) => d >= from && d <= to && e.mood === m).length;
  const recent = count(addDays(t, -13), t, "not_great"), before = count(addDays(t, -27), addDays(t, -14), "not_great");
  const answered = [...byDay.keys()].filter((d) => d >= addDays(t, -13)).length;
  return { cells, recent, before, answered, rising: recent >= 3 && recent > before };
}
