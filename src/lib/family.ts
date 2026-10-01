import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today, type Child, type Household, type Night } from "@/lib/kin";

/** Children, homes and where the children sleep from `from` for `days` nights. */
export async function loadFamily(supabase: SupabaseClient, circleId: string, opts: { from?: string; days?: number } = {}) {
  const from = opts.from || addDays(today(), -1);
  const to = addDays(from, (opts.days ?? 21) - 1);
  const [{ data: kids }, { data: homes }, { data: nights }] = await Promise.all([
    supabase.from("children").select("*").eq("circle_id", circleId).order("sort").order("date_of_birth"),
    supabase.from("households").select("*").eq("circle_id", circleId).order("sort"),
    supabase.rpc("nights", { c: circleId, from_date: from, to_date: to }),
  ]);
  const households = (homes || []) as Household[];
  const N = ((nights || []) as Night[]).map((n) => ({ ...n, night: String(n.night).slice(0, 10) }));
  const home = (id: string | null | undefined) => households.find((h) => h.id === id) || null;
  const nightOf = (d: string) => N.find((n) => n.night === d) || null;
  return { children: (kids || []) as Child[], households, nights: N, home, nightOf, twoHomes: households.length > 1 && N.some((n) => n.household_id) };
}
export type Family = Awaited<ReturnType<typeof loadFamily>>;
