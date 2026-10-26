import Link from "next/link";
import { getCircle } from "@/lib/data";
import { addDays, dayLabel, today, type Checkin, type Task } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { gaps, rota, weekdayOf, WEEKDAYS } from "@/lib/support";
import { saveVisitDays, volunteerVisit } from "../actions";

export default async function Rota({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, me, nameOf, members } = await getCircle(id);
  if (role === "helper" || role === "supported") return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>The rota is for the family.</p></main>;
  const t = today();
  const [{ data: tasks }, { data: checkins }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", id).in("status", ["open", "accepted"]).eq("category", "Visit"),
    supabase.from("checkins").select("*").eq("circle_id", id).gte("checked_in_at", t),
  ]);
  const visitDays = circle.visit_days || [];
  const days = rota({ visitDays, tasks: (tasks || []) as Task[], checkins: (checkins || []) as Checkin[], days: 14 });
  const open = gaps(days);
  const load = members.filter((m) => m.status === "active" && ["admin", "family", "contributor"].includes(m.role))
    .map((m) => ({ m, n: days.reduce((a, d) => a + d.cover.filter((x) => x.who === m.user_id).length, 0) })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...load.map((x) => x.n));
  return (
    <main className="page">
      <Header title="Care rota" sub={`Who's visiting or calling ${circle.preferred_name} in the next two weeks`} initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/more`, label: "More" }} />
      <Notice sp={sp} />
      {!visitDays.length ? (
        <p className="card pad">Choose the days {circle.preferred_name} should have a visit or call, and KIN will show any day nobody has covered.</p>
      ) : open.length ? (
        <section className="status attn"><div className="sline"><span className="dot" />{open.length === 1 ? "1 day needs someone" : `${open.length} days need someone`}</div>
          <ul>{open.slice(0, 4).map((d) => <li key={d.date}>Nobody&apos;s visiting {dayLabel(d.date) === "Today" || dayLabel(d.date) === "Tomorrow" ? dayLabel(d.date).toLowerCase() : `on ${dayLabel(d.date)}`}</li>)}</ul></section>
      ) : <section className="status good"><div className="sline"><span className="dot" />Every visit day is covered</div></section>}

      <div className="rota" role="list" aria-label="Next 14 days">
        {days.map((d) => {
          const gap = d.needed && !d.cover.length && !d.checkedIn.length;
          return (
            <div key={d.date} role="listitem" className={`rday${gap ? " gap" : !d.needed && !d.cover.length ? " off" : ""}`}>
              <b>{WEEKDAYS[weekdayOf(d.date)].slice(0, 3)} {Number(d.date.slice(8))}</b>
              {d.cover.map((c, i) => <span key={i}>{nameOf(c.who)}</span>)}
              {d.checkedIn.filter((u) => !d.cover.some((c) => c.who === u)).map((u) => <span key={u}>{nameOf(u)} (checked in)</span>)}
              {gap && <span style={{ color: "var(--coral)", fontWeight: 700 }}>Nobody yet</span>}
              {!d.needed && !d.cover.length && <span>Not needed</span>}
            </div>
          );
        })}
      </div>

      {!!open.length && (
        <section className="stack">
          <h2>Can you take one?</h2>
          <div className="card list">
            {open.map((d) => (
              <form key={d.date} action={volunteerVisit} className="item" style={{ flexWrap: "wrap" }}>
                <Hidden circle={id} /><input type="hidden" name="date" value={d.date} />
                <span className="main"><span className="t">{dayLabel(d.date)}</span><span className="s">{d.date === addDays(t, 0) ? "Today" : WEEKDAYS[weekdayOf(d.date)]}</span></span>
                <label className="checkline small"><input type="checkbox" name="weekly" /> Every week</label>
                <button className="btn sm primary">I&apos;ll visit</button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Sharing the load</h2>
        <div className="card pad stack">
          {load.map(({ m, n }) => (
            <div key={m.user_id} className="row" style={{ gap: 12 }}>
              <span style={{ width: 90 }} className="small">{nameOf(m.user_id)}</span>
              <span style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--sunk)", position: "relative" }}>
                <span style={{ position: "absolute", inset: 0, width: `${(n / max) * 100}%`, background: "var(--accent)", borderRadius: 5 }} /></span>
              <span className="small" style={{ width: 70, textAlign: "right" }}>{n} {n === 1 ? "visit" : "visits"}</span>
            </div>
          ))}
          <span className="note">Visits and calls in the next two weeks. Add regular ones as tasks in the Visit category.</span>
        </div>
      </section>

      {role === "admin" && (
        <form action={saveVisitDays} className="card pad form">
          <Hidden circle={id} />
          <b>Days {circle.preferred_name} should have a visit or call</b>
          <div className="row">{WEEKDAYS.map((w, i) => (
            <label key={w} className="checkline"><input type="checkbox" name="day" value={i} defaultChecked={visitDays.includes(i)} /> {w.slice(0, 3)}</label>
          ))}</div>
          <button className="btn">Save days</button>
        </form>
      )}
    </main>
  );
}
