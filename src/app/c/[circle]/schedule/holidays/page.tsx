import Link from "next/link";
import { getCircle } from "@/lib/data";
import { loadFamily } from "@/lib/family";
import { addDays, canEdit, dayLabel, longDate, today } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import ToneCheck from "@/components/ToneCheck";
import { specialDays, type SpecialDay } from "@/lib/support";
import { proposeSpecial } from "../../actions";

type Req = { id: string; label: string | null; start_date: string; end_date: string; household_id: string; status: string; requested_by: string | null };

export default async function Holidays({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, me, nameOf } = await getCircle(id);
  if (!canEdit(role)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Holiday planning is for parents.</p></main>;
  const t = today();
  const fam = await loadFamily(supabase, id, { from: t, days: 380 });
  const [{ data: reqs }, { data: events }] = await Promise.all([
    supabase.from("schedule_changes").select("id, label, start_date, end_date, household_id, status, requested_by").eq("circle_id", id).in("status", ["requested", "accepted"]).gte("end_date", t),
    supabase.from("appointments").select("title, date, end_date").eq("circle_id", id).gte("date", t).not("end_date", "is", null),
  ]);
  // School holidays come from multi-day events on the calendar, such as half terms
  const school: SpecialDay[] = (events || []).filter((e) => /holiday|half term|half-term|break|inset/i.test(e.title))
    .map((e) => ({ key: `ev-${e.date}-${e.title}`, title: e.title, start: e.date, end: e.end_date!, kind: "school" as const }));
  const days = [...specialDays(fam.children, t), ...school].sort((a, b) => a.start.localeCompare(b.start));
  const requests = (reqs || []) as Req[];
  const homesFor = (d: SpecialDay) => {
    const ids: string[] = [];
    for (let x = d.start; x <= d.end; x = addDays(x, 1)) { const n = fam.nightOf(x); if (n?.household_id) ids.push(n.household_id); }
    const uniq = [...new Set(ids)];
    return uniq.length === 1 ? `At ${fam.home(uniq[0])?.name}` : uniq.length ? `Split: ${uniq.map((h) => fam.home(h)?.name).join(" and ")}` : "Not set";
  };
  const reqFor = (d: SpecialDay) => requests.find((r) => r.start_date <= d.end && r.end_date >= d.start);
  return (
    <main className="page">
      <Header title="Holidays and special days" sub="Agree them months ahead. Once agreed, they fill the schedule." initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/schedule`, label: "Schedule" }} />
      <Notice sp={sp} />
      {!fam.twoHomes && <p className="card pad">Set up the two homes and usual pattern first, in Family settings.</p>}
      <p className="note">School holidays appear here when they&apos;re on the calendar as events with dates, such as &ldquo;October half term&rdquo;.</p>
      <div className="stack">
        {days.map((d) => {
          const r = reqFor(d);
          return (
            <div key={d.key} className="card pad">
              <div className="row between">
                <div><b>{d.title}</b><div className="small muted">{d.start === d.end ? longDate(d.start) : `${dayLabel(d.start)} to ${dayLabel(d.end)}`}</div></div>
                <span className={`tag ${r ? (r.status === "accepted" ? "" : "unas") : ""}`}>{r ? (r.status === "accepted" ? `Agreed: ${fam.home(r.household_id)?.name}` : `Proposed by ${nameOf(r.requested_by)}`) : homesFor(d)}</span>
              </div>
              {r && <Link href={`/c/${id}/thread/change/${r.id}`} className="link small">{r.status === "accepted" ? "See the discussion" : "Discuss or answer"}</Link>}
              {!r && fam.twoHomes && (
                <details>
                  <summary className="link small" style={{ cursor: "pointer" }}>Propose a plan</summary>
                  <form action={proposeSpecial} className="form" style={{ marginTop: 10 }}>
                    <Hidden circle={id} /><input type="hidden" name="label" value={d.title} />
                    <div className="two">
                      <label className="fl">From night of<input type="date" name="start_date" defaultValue={d.start} required /></label>
                      <label className="fl">To night of<input type="date" name="end_date" defaultValue={d.end} required /></label>
                    </div>
                    <label className="fl">The children would be at<select name="household_id">{fam.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
                    <ToneCheck circleId={id} name="note" label="Note (optional)" input maxLength={500} placeholder="e.g. Then with Dad from 2pm on Christmas Day" />
                    <span className="note">For a split day, propose the night they sleep at each home. Nothing changes until another parent agrees.</span>
                    <button className="btn primary">Send to the other parent</button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
