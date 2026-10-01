import Link from "next/link";
import { getCircle } from "@/lib/data";
import { loadFamily } from "@/lib/family";
import { addDays, canEdit, dayLabel, hm, longDate, today, when, type Appointment, type ScheduleChange } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { cancelChange, requestChange, agreeChange, declineChange } from "../actions";

const dow = (s: string) => (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7;
const range = (c: ScheduleChange) => (c.start_date === c.end_date ? longDate(c.start_date) : `${dayLabel(c.start_date)} to ${dayLabel(c.end_date)}`);

export default async function Schedule({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, user, nameOf, me } = await getCircle(id);
  const base = `/c/${id}`;
  const parent = canEdit(role);
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(sp.d || "") ? sp.d : today();
  const first = sel.slice(0, 8) + "01";
  const from = addDays(first, -dow(first));
  const fam = await loadFamily(supabase, id, { from: addDays(from, -1), days: 44 });
  const [{ data: changes }, { data: pattern }, { data: appts }] = await Promise.all([
    parent ? supabase.from("schedule_changes").select("*").eq("circle_id", id).order("requested_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
    parent ? supabase.from("schedule_patterns").select("label").eq("circle_id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("appointments").select("*").eq("circle_id", id).lte("date", addDays(from, 41)).or(`date.gte.${from},end_date.gte.${from}`),
  ]);
  const C = (changes || []) as ScheduleChange[];
  const waiting = C.filter((c) => c.status === "requested" && c.requested_by !== user.id);
  const mine = C.filter((c) => c.status === "requested" && c.requested_by === user.id);
  const history = C.filter((c) => c.status !== "requested").slice(0, 15);
  const shift = (n: number) => { const d = new Date(first + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
  const selHome = fam.home(fam.nightOf(sel)?.household_id);
  const selEvents = ((appts || []) as Appointment[]).filter((a) => a.date <= sel && sel <= (a.end_date || a.date));
  const other = fam.households.find((h) => h.id !== selHome?.id);

  if (!fam.households.length) return (
    <main className="page">
      <Header title="Schedule" initial={(me.profiles?.display_name || "?")[0]} back={{ href: base, label: "Home" }} />
      <div className="card pad"><b>Do the children live across two homes?</b><p className="small muted">Add both homes and a regular pattern, and KIN shows everyone where the children are each night, handles swap requests and reminds you what to pack.</p>
        {parent && <Link href={`${base}/schedule/settings`} className="btn primary">Set up two homes</Link>}</div>
    </main>
  );

  return (
    <main className="page">
      <Header title="Schedule" sub={pattern?.label ? `Usual pattern: ${pattern.label}` : "Where the children sleep each night"} initial={(me.profiles?.display_name || "?")[0]} back={{ href: base, label: "Home" }} />
      <Notice sp={sp} />
      <div className="row between"><Link className="link" href={`${base}/schedule?d=${shift(-1)}`}>‹ Previous</Link>
        <b>{new Date(first + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</b>
        <Link className="link" href={`${base}/schedule?d=${shift(1)}`}>Next ›</Link></div>
      <div className="month">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(from, i);
          const n = fam.nightOf(d);
          const h = fam.home(n?.household_id);
          const ev = ((appts || []) as Appointment[]).filter((a) => a.date <= d && d <= (a.end_date || a.date)).length;
          return (
            <Link key={d} href={`${base}/schedule?d=${d}`} aria-current={d === sel} aria-label={`${longDate(d)}: ${h?.name || "not set"}${n?.changed ? ", changed" : ""}${ev ? `, ${ev} events` : ""}`}
              className={`home col-${h?.colour || "none"} ${d.slice(0, 7) !== first.slice(0, 7) ? "out" : ""} ${d === today() ? "today" : ""}`}>
              {Number(d.slice(8))}<span className="dots">{n?.changed && <i style={{ background: "var(--ink)" }} />}{ev > 0 && <i className="k-appointment" />}</span>
            </Link>
          );
        })}
      </div>
      <div className="row small muted">{fam.households.map((h) => <span key={h.id} className={`col-${h.colour}`}><span className="legend-dot" />{h.name}</span>)}<span>• changed from the usual pattern</span></div>

      <section className={`tonight col-${selHome?.colour || "none"}`}>
        <span className="label">{longDate(sel)}</span>
        <span className="big">{selHome ? `At ${selHome.name}` : "No home set"}</span>
        {fam.nightOf(sel)?.changed && <span className="small">Changed from the usual pattern by agreement.</span>}
        {selEvents.map((a) => <Link key={a.id} href={`${base}/appointments/${a.id}`} className="small">{a.title}{a.time && a.date === sel ? ` at ${hm(a.time)}` : ""}</Link>)}
      </section>

      {parent && waiting.length > 0 && (
        <section className="stack"><h2>Waiting for your answer</h2>
          {waiting.map((c) => (
            <div key={c.id} className="card pad reqcard">
              <b>{nameOf(c.requested_by)} asks for {range(c)} at {fam.home(c.household_id)?.name}</b>
              {c.reason && <p className="small">&ldquo;{c.reason}&rdquo;</p>}
              {c.in_return && <p className="small muted">In return: {c.in_return}</p>}
              <p className="note">Asked {when(c.requested_at).toLowerCase()}</p>
              <form className="stack">
                <Hidden circle={id} id={c.id} />
                <label className="fl"><span className="sr-only">Note</span><input name="note" placeholder="Add a note (optional)" maxLength={500} /></label>
                <div className="row"><button formAction={agreeChange} className="btn primary sm">Agree</button><button formAction={declineChange} className="btn sm">Say no</button></div>
              </form>
            </div>
          ))}
        </section>
      )}

      {parent && (
        <details className="card pad" open={!!sp.ask}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>Ask for a change</summary>
          <form action={requestChange} className="form" style={{ marginTop: 12 }}>
            <Hidden circle={id} />
            <div className="two">
              <label className="fl">From night of<input type="date" name="start_date" defaultValue={sel} required /></label>
              <label className="fl">To night of<input type="date" name="end_date" defaultValue={sel} required /></label>
            </div>
            <label className="fl">The children would be at<select name="household_id" defaultValue={other?.id}>{fam.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label className="fl">Reason<input name="reason" maxLength={500} placeholder="e.g. Work trip, back Sunday afternoon" /></label>
            <label className="fl">In return (optional)<input name="in_return" maxLength={300} placeholder="e.g. I'll have them the following weekend instead" /></label>
            <p className="note">Keep it short and about the children. Nothing changes until another parent agrees, and both of you get a record.</p>
            <button className="btn primary">Send request</button>
          </form>
        </details>
      )}

      {parent && mine.length > 0 && (
        <section className="stack"><h2>Your requests</h2>
          <div className="card list">{mine.map((c) => (
            <div key={c.id} className="item"><span className="main"><span className="t">{range(c)} at {fam.home(c.household_id)?.name}</span><span className="s">Waiting for an answer · asked {when(c.requested_at).toLowerCase()}</span></span>
              <form action={cancelChange}><Hidden circle={id} id={c.id} /><button className="btn sm">Withdraw</button></form></div>
          ))}</div>
        </section>
      )}

      {parent && history.length > 0 && (
        <section className="stack"><h2>History</h2>
          <div className="card list">{history.map((c) => (
            <div key={c.id} className="item"><span className="main"><span className="t">{range(c)} at {fam.home(c.household_id)?.name}</span>
              <span className="s">Asked by {nameOf(c.requested_by)} · <span className={`tag ${c.status === "accepted" ? "done" : c.status === "declined" ? "over" : ""}`}>{{ accepted: "Agreed", declined: "Not agreed", cancelled: "Withdrawn", requested: "" }[c.status]}</span>
                {c.responded_by && ` by ${nameOf(c.responded_by)}`}{c.response_note ? `: “${c.response_note}”` : ""}</span></span></div>
          ))}</div>
          <Link href={`${base}/records`} className="link">Full record</Link>
        </section>
      )}
      {parent && <Link href={`${base}/schedule/settings`} className="btn">Homes, usual pattern and packing list</Link>}
    </main>
  );
}
