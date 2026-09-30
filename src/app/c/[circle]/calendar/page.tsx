import Link from "next/link";
import { getCircle } from "@/lib/data";
import { addDays, canEdit, dayLabel, hm, kindOf, longDate, today, type Appointment, type Task } from "@/lib/kin";
import { Header, Notice, Rows, taskRow, type Row } from "@/components/ui";

const dow = (s: string) => (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7;

export default async function Calendar({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, nameOf, me } = await getCircle(id);
  const view = sp.v === "month" ? "month" : sp.v === "day" ? "day" : "week";
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(sp.d || "") ? sp.d : today();
  const base = `/c/${id}`;
  let from: string, to: string;
  if (view === "month") {
    const first = sel.slice(0, 8) + "01";
    from = addDays(first, -dow(first));
    to = addDays(from, 41);
  } else if (view === "week") {
    from = addDays(sel, -dow(sel));
    to = addDays(from, 6);
  } else { from = sel; to = sel; }
  const [{ data: tasks }, { data: appts }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", id).in("status", ["open", "accepted"]).gte("due_date", from).lte("due_date", to),
    supabase.from("appointments").select("*").eq("circle_id", id).gte("date", from).lte("date", to).order("time"),
  ]);
  const T = (tasks || []) as Task[], A = (appts || []) as Appointment[];
  const kinds = (d: string) => [...A.filter((a) => a.date === d).map(() => "appointment"), ...T.filter((t) => t.due_date === d && !t.appointment_id).map((t) => kindOf(t)), ...T.filter((t) => t.due_date === d && t.appointment_id).map(() => "transport")];
  const rowsFor = (d: string): Row[] => [
    ...A.filter((a) => a.date === d).map((a) => ({ kind: "appointment", when: hm(a.time), title: a.title, href: `${base}/appointments/${a.id}`,
      sub: <>{a.location}{a.needs_transport && (a.driver ? ` · ${nameOf(a.driver)} driving` : <> · <span className="tag unas">No driver yet</span></>)}</> })),
    ...T.filter((t) => t.due_date === d).map((t) => taskRow(t, base, nameOf, { when: "time" })),
  ].sort((x, y) => (x.when || "99").localeCompare(y.when || "99"));
  const link = (v: string, d: string) => `${base}/calendar?v=${v}&d=${d}`;
  const monthName = new Date(sel.slice(0, 8) + "15T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const shiftMonth = (n: number) => { const d = new Date(sel.slice(0, 8) + "01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

  return (
    <main className="page">
      <Header title="Calendar" sub={circle.person_name} initial={(me.profiles?.display_name || "?")[0]} />
      <Notice sp={sp} />
      <nav className="chips" aria-label="Calendar view">
        {["day", "week", "month"].map((v) => <Link key={v} href={link(v, sel)} className="chip" aria-current={view === v}>{v[0].toUpperCase() + v.slice(1)}</Link>)}
      </nav>
      {view === "week" && (<>
        <div className="row between"><Link className="link" href={link("week", addDays(sel, -7))}>‹ Previous</Link>
          <b>{dayLabel(from).replace(/^\w+ /, "")} – {dayLabel(to).replace(/^\w+ /, "")}</b>
          <Link className="link" href={link("week", addDays(sel, 7))}>Next ›</Link></div>
        <div className="days">{Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return (
          <Link key={d} href={link("week", d)} aria-current={d === sel}>
            <span>{new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span><b>{Number(d.slice(8))}</b>
            <span className="dots">{kinds(d).slice(0, 4).map((k, j) => <i key={j} className={`k-${k}`} />)}</span></Link>); })}</div>
      </>)}
      {view === "day" && <div className="row between"><Link className="link" href={link("day", addDays(sel, -1))}>‹</Link><b>{longDate(sel)}</b><Link className="link" href={link("day", addDays(sel, 1))}>›</Link></div>}
      {view === "month" && (<>
        <div className="row between"><Link className="link" href={link("month", shiftMonth(-1))}>‹ Previous</Link><b>{monthName}</b><Link className="link" href={link("month", shiftMonth(1))}>Next ›</Link></div>
        <div className="month">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow">{d}</span>)}
          {Array.from({ length: 42 }, (_, i) => { const d = addDays(from, i); return (
            <Link key={d} href={link("month", d)} aria-current={d === sel} aria-label={`${longDate(d)}, ${kinds(d).length} items`}
              className={`${d.slice(0, 7) !== sel.slice(0, 7) ? "out" : ""} ${d === today() ? "today" : ""}`}>
              {Number(d.slice(8))}<span className="dots">{kinds(d).slice(0, 3).map((k, j) => <i key={j} className={`k-${k}`} />)}</span></Link>); })}
        </div>
      </>)}
      <section className="stack"><h2>{view === "day" ? "Plans" : longDate(sel)}</h2><Rows rows={rowsFor(sel)} empty="Nothing planned." /></section>
      <div className="row">
        {["appointment", "visit", "transport", "task", "maintenance"].map((k) => <span key={k} className={`tag k-${k}`}>{{ appointment: "Appointment", visit: "Visit or call", transport: "Transport", task: "Task", maintenance: "Maintenance" }[k]}</span>)}
      </div>
      <div className="row">
        {canEdit(role) && <Link href={`${base}/appointments/new`} className="btn primary">Add appointment</Link>}
        <Link href={`${base}/tasks/new`} className="btn">Add task</Link>
      </div>
    </main>
  );
}
