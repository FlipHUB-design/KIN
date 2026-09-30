import Link from "next/link";
import { getCircle } from "@/lib/data";
import {
  addDays, canEdit, circleStatus, dateOf, dayLabel, hm, isOverdue, longDate, missedCheckin, timeOf, today, when,
  type Activity, type Appointment, type Checkin, type Task,
} from "@/lib/kin";
import { Disclaimer, Header, Hidden, Notice, Rows, taskRow, type Row } from "@/components/ui";
import { askFamily, checkOut, dismissMissed, needHelp, wellbeing } from "./actions";

export default async function Home({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const ctx = await getCircle(id);
  if (ctx.role === "supported") return <SupportedHome ctx={ctx} sp={sp} />;
  if (ctx.role === "helper") return <HelperHome ctx={ctx} sp={sp} />;
  return <FamilyHome ctx={ctx} sp={sp} />;
}

type Ctx = Awaited<ReturnType<typeof getCircle>>;

async function load(ctx: Ctx) {
  const { supabase, circle } = ctx;
  const t = today();
  const [tasks, appts, checkins, activity, circles] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).in("status", ["open", "accepted"]).order("due_date"),
    supabase.from("appointments").select("*").eq("circle_id", circle.id).gte("date", t).lte("date", addDays(t, 14)).order("date").order("time"),
    supabase.from("checkins").select("*").eq("circle_id", circle.id).gte("checked_in_at", addDays(t, -2)).order("checked_in_at", { ascending: false }),
    supabase.from("activity").select("*").eq("circle_id", circle.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("memberships").select("care_circles(id, preferred_name)").eq("user_id", ctx.user.id).eq("status", "active"),
  ]);
  return {
    tasks: (tasks.data || []) as Task[], appts: (appts.data || []) as Appointment[], checkins: (checkins.data || []) as Checkin[],
    activity: (activity.data || []) as Activity[],
    circles: (circles.data || []).map((r) => r.care_circles as unknown as { id: string; preferred_name: string }),
  };
}

function dayRows(date: string, tasks: Task[], appts: Appointment[], ctx: Ctx, base: string): Row[] {
  const rows: (Row & { sort: string })[] = [];
  appts.filter((a) => a.date === date).forEach((a) => rows.push({
    kind: "appointment", when: hm(a.time), title: a.title, href: `${base}/appointments/${a.id}`, sort: hm(a.time) || "99",
    sub: <>{a.location}{a.needs_transport && (a.driver ? ` · ${ctx.nameOf(a.driver)} driving` : <> · <span className="tag unas">No driver yet</span></>)}</>,
  }));
  tasks.filter((t) => t.due_date === date && !isOverdue(t)).forEach((t) => rows.push({ ...taskRow(t, base, ctx.nameOf, { when: "time" }), sort: hm(t.due_time) || "99" }));
  return rows.sort((a, b) => a.sort.localeCompare(b.sort));
}

async function FamilyHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { circle, members, nameOf, role, user } = ctx;
  const base = `/c/${circle.id}`;
  const d = await load(ctx);
  const t = today();
  const s = circleStatus({ circle, tasks: d.tasks, appts: d.appts, checkins: d.checkins, dismissedToday: circle.checkin_dismissed_on === t });
  const myOpen = d.checkins.find((c) => c.user_id === user.id && !c.checked_out_at && dateOf(c.checked_in_at) === t);
  const todays = d.checkins.filter((c) => dateOf(c.checked_in_at) === t);
  const missed = missedCheckin(circle, d.checkins) && circle.checkin_dismissed_on !== t;
  const need = d.tasks.filter((x) => isOverdue(x) || (!x.assignee && x.due_date && x.due_date <= addDays(t, 7)));
  const upcoming: Row[] = [];
  for (let i = 1; i <= 14 && upcoming.length < 7; i++) {
    const day = addDays(t, i);
    dayRows(day, d.tasks, d.appts, ctx, base).forEach((r) => upcoming.push({ ...r, when: undefined, sub: <>{dayLabel(day)}{r.when ? ` · ${r.when}` : ""} · {r.sub}</> }));
  }
  const fam = members.filter((m) => ["admin", "family", "contributor"].includes(m.role) && m.status === "active");
  const week = addDays(t, 7);
  const load7 = fam.map((m) => ({ m, n: d.tasks.filter((x) => x.assignee === m.user_id && (!x.due_date || x.due_date <= week)).length })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...load7.map((x) => x.n));
  const nudge = load7.length > 1 && load7[0].n >= 3 && load7[0].n >= 2 * Math.max(1, load7[1].n);
  const me = members.find((m) => m.user_id === user.id);

  return (
    <main className="page">
      <Header title="Home" sub={`${circle.person_name} · ${longDate(t)}`} initial={(me?.profiles?.display_name || "?")[0]} />
      {d.circles.length > 1 && (
        <div className="circles">
          {d.circles.map((c) => <Link key={c.id} href={`/c/${c.id}`} className="cchip" aria-current={c.id === circle.id}><b>{c.preferred_name}</b></Link>)}
        </div>
      )}
      <Notice sp={sp} />
      <section className={`status ${s.cls}`} aria-live="polite">
        <div className="sline"><span className="dot" />{s.label}</div>
        {s.reasons.length ? <ul>{s.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
          : <p style={{ color: "var(--ink)" }}>Everything coming up has someone looking after it.</p>}
        <p className="small muted">Family coordination status only. It isn&apos;t a health or safety assessment.</p>
      </section>

      {missed && (
        <section className="missed">
          <h3>{circle.preferred_name} has not had a recorded check-in today.</h3>
          <p className="small muted">{circle.checkin_note || `Someone usually checks in by ${hm(circle.checkin_by)}.`} This doesn&apos;t mean anything is wrong.</p>
          <div className="row">
            <Link href={`${base}/checkin`} className="btn sm primary">Check in yourself</Link>
            <form action={askFamily}><Hidden circle={circle.id} /><button className="btn sm">Ask the family</button></form>
            {canEdit(role) && <form action={dismissMissed}><Hidden circle={circle.id} /><button className="btn sm">Mark as expected</button></form>}
          </div>
        </section>
      )}

      <section className="card pad" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        {myOpen ? (
          <>
            <div><b>You&apos;re checked in</b><p className="small muted">Since {timeOf(myOpen.checked_in_at)}{myOpen.mood ? ` · ${myOpen.mood}` : ""}</p></div>
            <form action={checkOut}><Hidden circle={circle.id} /><button className="btn primary">Check out</button></form>
          </>
        ) : (
          <>
            <div><b>Visiting or calling {circle.preferred_name}?</b>
              <p className="small muted">{todays.length ? `Checked in today by ${[...new Set(todays.map((c) => nameOf(c.user_id)))].join(", ")}` : "No check-in yet today"}</p></div>
            <Link href={`${base}/checkin`} className="btn primary">Check in</Link>
          </>
        )}
      </section>

      <section className="stack">
        <div className="row between"><h2>Today</h2><Link href={`${base}/calendar`} className="link">Calendar</Link></div>
        <Rows rows={dayRows(t, d.tasks, d.appts, ctx, base)} empty="Nothing planned today." />
      </section>

      <section className="stack">
        <div className="row between"><h2>Needs attention</h2><Link href={`${base}/tasks`} className="link">All tasks</Link></div>
        <Rows rows={need.map((x) => taskRow(x, base, nameOf))} empty="Nothing needs attention." />
      </section>

      <section className="stack">
        <div className="row between"><h2>Next two weeks</h2>{canEdit(role) && <Link href={`${base}/appointments/new`} className="link">Add appointment</Link>}</div>
        <Rows rows={upcoming} empty="Nothing booked yet." />
      </section>

      {canEdit(role) && fam.length > 1 && (
        <section className="stack">
          <h2>This week&apos;s load</h2>
          <div className="card work">
            {load7.map(({ m, n }) => (
              <div key={m.user_id} className="wrow"><span>{nameOf(m.user_id)}</span><span className="wtrack"><i style={{ width: `${(n / max) * 100}%` }} /></span><span style={{ textAlign: "right" }}>{n}</span></div>
            ))}
            {nudge && <p className="nudge">{nameOf(load7[0].m.user_id)} {load7[0].m.user_id === user.id ? "have" : "has"} most of this week&apos;s tasks. Could someone take one?</p>}
          </div>
        </section>
      )}

      <section className="stack">
        <div className="row between"><h2>Recent activity</h2><Link href={`${base}/more/activity`} className="link">See all</Link></div>
        <div className="card list">
          {d.activity.length ? d.activity.map((a) => (
            <div key={a.id} className="item"><span className="avatar sm">{nameOf(a.actor)[0]}</span>
              <span className="main"><span><b>{nameOf(a.actor)}</b> {a.verb}{a.subject ? ` ${a.subject}` : ""}</span><span className="s">{when(a.created_at)}</span></span></div>
          )) : <p className="empty">Nothing yet.</p>}
        </div>
      </section>
      <Disclaimer />
    </main>
  );
}

async function HelperHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { supabase, circle, user, members, nameOf } = ctx;
  const base = `/c/${circle.id}`;
  const [{ data: tasks }, { data: visit }, { data: open }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).eq("assignee", user.id).in("status", ["open", "accepted"]).order("due_date"),
    supabase.from("visit_info").select("*").eq("circle_id", circle.id).maybeSingle(),
    supabase.from("checkins").select("*").eq("circle_id", circle.id).eq("user_id", user.id).is("checked_out_at", null).order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const key = members.find((m) => m.user_id === visit?.key_contact_user) || members.find((m) => m.role === "admin");
  const me = members.find((m) => m.user_id === user.id);
  return (
    <main className="page">
      <Header title={`Hello ${(me?.profiles?.display_name || "").split(" ")[0]}`} sub={`Your visits for ${circle.preferred_name}`} initial={(me?.profiles?.display_name || "?")[0]} />
      <Notice sp={sp} />
      <section className="card pad" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        {open ? (
          <><div><b>You&apos;re checked in</b><p className="small muted">Since {timeOf(open.checked_in_at)}</p></div>
            <form action={checkOut}><Hidden circle={circle.id} /><button className="btn primary">Check out</button></form></>
        ) : (
          <><div><b>Arrived?</b><p className="small muted">Let the family know you&apos;re there.</p></div>
            <Link href={`${base}/checkin`} className="btn primary">Check in</Link></>
        )}
      </section>
      <section className="stack"><h2>Your upcoming visits</h2>
        <Rows rows={((tasks || []) as Task[]).map((x) => ({ ...taskRow(x, base, nameOf), when: undefined, sub: `${dayLabel(x.due_date)}${x.due_time ? " at " + hm(x.due_time) : ""}` }))} empty="No visits booked." />
      </section>
      <section className="stack"><h2>What you need</h2>
        <div className="card"><dl className="kv">
          <dt>Address</dt><dd>{visit?.address || "Not added yet"}</dd>
          <dt>Getting in</dt><dd>{visit?.access_instructions || "Not added yet"}</dd>
          <dt>Contact</dt><dd>{key?.profiles?.display_name || "Not set"}{key?.profiles?.phone && <><br /><span className="phone">{key.profiles.phone}</span></>}</dd>
        </dl></div>
      </section>
      <p className="note">You can see only what you need for your visits. Health details, documents and family conversations stay private to the family.</p>
      <p className="disclaimer">In an emergency call 999.</p>
    </main>
  );
}

async function SupportedHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { supabase, circle, nameOf, user } = ctx;
  const base = `/c/${circle.id}`;
  const t = today();
  const [{ data: tasks }, { data: appts }, { data: said }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).in("due_date", [t, addDays(t, 1)]).in("status", ["open", "accepted"]),
    supabase.from("appointments").select("*").eq("circle_id", circle.id).in("date", [t, addDays(t, 1)]),
    supabase.from("activity").select("id").eq("circle_id", circle.id).eq("actor", user.id).like("verb", "said they're feeling%").gte("created_at", t),
  ]);
  const describe = (x: Task) => x.category === "Visit" && x.assignee ? `${nameOf(x.assignee)} is ${/call/i.test(x.title) ? "calling" : "visiting"}` : x.assignee ? `${nameOf(x.assignee)}: ${x.title}` : x.title;
  const on = (day: string) => [
    ...((appts || []) as Appointment[]).filter((a) => a.date === day).map((a) => ({ time: hm(a.time), text: `${a.title}${a.driver ? `. ${nameOf(a.driver)} is driving you` : ""}` })),
    ...((tasks || []) as Task[]).filter((x) => x.due_date === day && ["Visit", "Household", "Shopping"].includes(x.category)).map((x) => ({ time: hm(x.due_time), text: describe(x) })),
  ].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const today_ = on(t), tomorrow = on(addDays(t, 1));
  return (
    <main className="page sp">
      <div><span className="brand">KIN</span><h1>Today</h1><p className="muted">{longDate(t)}</p></div>
      <Notice sp={sp} />
      <div className="stack">
        {today_.length ? today_.map((r, i) => <div key={i} className="trow"><div><b>{r.time}</b><div>{r.text}</div></div></div>)
          : <div className="trow"><div>Nothing planned today.</div></div>}
      </div>
      {tomorrow.length > 0 && (
        <div className="card pad"><span className="label">Tomorrow</span>{tomorrow.map((r, i) => <p key={i}>{r.time && <b>{r.time} </b>}{r.text}</p>)}</div>
      )}
      <div className="card pad">
        <h2 style={{ fontSize: 24 }}>How are you today?</h2>
        {said?.length ? <p>Thank you. Your family can see your answer.</p> : (
          <form action={wellbeing} className="form">
            <Hidden circle={circle.id} />
            <fieldset className="choice" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">How are you?</legend>
              {["Good", "OK", "Not great"].map((m) => <label key={m}><input type="radio" name="mood" value={m} required /><span>{m}</span></label>)}
            </fieldset>
            <label className="fl" style={{ fontSize: 17 }}>Anything you&apos;d like your family to know?<textarea name="note" /></label>
            <button className="btn primary">Send to my family</button>
          </form>
        )}
      </div>
      <div className="big">
        <Link href={`${base}/help`}>Call family</Link>
        <form action={needHelp}><Hidden circle={circle.id} /><button className="help">I need help</button></form>
        <Link href={`${base}/me#appointments`}>My appointments</Link>
        <Link href={`${base}/me`}>My information</Link>
      </div>
      <p className="disclaimer" style={{ fontSize: 16 }}>In an emergency, call 999.</p>
    </main>
  );
}
