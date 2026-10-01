import Link from "next/link";
import type { getCircle } from "@/lib/data";
import { loadFamily, type Family } from "@/lib/family";
import {
  addDays, ageOn, balances, canEdit, childNames, dayLabel, hm, isLift, isOverdue, kidsLabel, kindOf, longDate, money, nextHandover, sharesOf, timeOf, today, when,
  type Activity, type Agreement, type Appointment, type Child, type ChildItem, type Expense, type ScheduleChange, type Settlement, type Task,
} from "@/lib/kin";
import { Disclaimer, Header, Hidden, Notice, Rows, type Row } from "@/components/ui";
import { checkOut, respondChange, youngPersonAsk } from "./actions";

type Ctx = Awaited<ReturnType<typeof getCircle>>;

// ---------------------------------------------------------------- small pieces
export function KidChips({ ids, kids }: { ids?: string[]; kids: Child[] }) {
  const list = (ids || []).map((id) => kids.find((k) => k.id === id)).filter(Boolean) as Child[];
  if (!list.length) return null;
  return <span className="pills" style={{ display: "inline-flex" }}>{list.map((k) => <span key={k.id} className={`kid col-${k.colour}`}>{k.first_name}</span>)}</span>;
}

export function Strip({ fam, base, days = 14, from = today() }: { fam: Family; base?: string; days?: number; from?: string }) {
  const cells = Array.from({ length: days }, (_, i) => addDays(from, i));
  return (
    <div>
      <div className="strip" role="list" aria-label="Where the children sleep each night">
        {cells.map((d) => {
          const n = fam.nightOf(d);
          const h = fam.home(n?.household_id);
          const label = `${longDate(d)}: ${h ? h.name : "not set"}${n?.changed ? " (changed)" : ""}`;
          const inner = (<><span>{new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</span><b>{Number(d.slice(8))}</b></>);
          const cls = `col-${h?.colour || "none"} ${d === today() ? "now" : ""} ${n?.changed ? "chg" : ""}`;
          return base
            ? <Link key={d} href={`${base}/schedule?d=${d}`} className={cls} aria-label={label} title={label} role="listitem">{inner}</Link>
            : <div key={d} className={cls} aria-label={label} title={label} role="listitem">{inner}</div>;
        })}
      </div>
      <div className="row small muted" style={{ marginTop: 6 }}>
        {fam.households.map((h) => <span key={h.id} className={`col-${h.colour}`}><span className="legend-dot" />{h.name}</span>)}
        {fam.nights.some((n) => n.changed) && <span>• changed from the usual pattern</span>}
      </div>
    </div>
  );
}

function Tonight({ fam, label, base, note }: { fam: Family; label: string; base: string; note?: string | null }) {
  const tonight = fam.home(fam.nightOf(today())?.household_id);
  const next = nextHandover(fam.nights);
  if (!tonight) return (
    <section className="card pad"><b>No regular schedule yet</b><p className="small muted">Set up which home the children sleep at each night, and everyone in the family can see it.</p>
      <Link href={`${base}/schedule/settings`} className="btn primary">Set up the schedule</Link></section>
  );
  const to = fam.home(next?.to);
  return (
    <section className={`tonight col-${tonight.colour}`} aria-live="polite">
      <span className="label">Tonight</span>
      <span className="big">{label} {label.includes(" and ") || label === "the children" ? "are" : "is"} at {tonight.name}</span>
      {next && to && <p>Next handover: <b>{dayLabel(next.date)}</b>, to {to.name}{note ? `. ${note}` : ""}</p>}
      <div className="row"><Link href={`${base}/handover`} className="btn sm primary">Handover checklist</Link><Link href={`${base}/schedule`} className="btn sm">Schedule</Link></div>
    </section>
  );
}

const covers = (a: Appointment, d: string) => a.date <= d && d <= (a.end_date || a.date);

function dayRows(d: string, tasks: Task[], appts: Appointment[], kids: Child[], ctx: Ctx, base: string, opts: { overdueOk?: boolean } = {}): Row[] {
  const rows: (Row & { sort: string })[] = [];
  appts.filter((a) => covers(a, d)).forEach((a) => rows.push({
    kind: "appointment", when: a.date === d ? hm(a.time) : "", title: a.title, href: `${base}/appointments/${a.id}`, sort: a.date === d ? hm(a.time) || "00" : "00",
    sub: <><KidChips ids={a.child_ids} kids={kids} />{a.end_date ? ` ${dayLabel(a.date)} to ${dayLabel(a.end_date)}` : ""}{a.location ? ` ${a.location}` : ""}
      {a.needs_transport && (a.driver ? ` · ${ctx.nameOf(a.driver)} taking them` : <> · <span className="tag unas">Who can take them?</span></>)}</>,
  }));
  tasks.filter((t) => t.due_date === d && (opts.overdueOk || !isOverdue(t)) && !t.appointment_id).forEach((t) => rows.push({
    kind: kindOf(t), when: hm(t.due_time), title: t.title, href: `${base}/tasks/${t.id}`, sort: hm(t.due_time) || "99",
    sub: <><KidChips ids={t.child_ids} kids={kids} /> {t.assignee ? `${ctx.nameOf(t.assignee)}${isLift(t) ? " taking them" : ""}` : <span className="tag unas">{isLift(t) ? "Who can take them?" : "Who can do this?"}</span>}</>,
  }));
  return rows.sort((a, b) => a.sort.localeCompare(b.sort));
}

// ---------------------------------------------------------------- parents, step-parents and grandparents
export async function KidsFamilyHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { supabase, circle, role, user, members, nameOf } = ctx;
  const base = `/c/${circle.id}`;
  const t = today();
  const parent = canEdit(role);
  const fam = await loadFamily(supabase, circle.id, { days: 30 });
  const kids = fam.children;
  const [tasksR, apptsR, actR, circlesR, reqR, expR, setR, agR] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).in("status", ["open", "accepted"]).order("due_date"),
    supabase.from("appointments").select("*").eq("circle_id", circle.id).lte("date", addDays(t, 14)).or(`date.gte.${addDays(t, -30)},end_date.gte.${t}`).order("date").order("time"),
    supabase.from("activity").select("*").eq("circle_id", circle.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("memberships").select("care_circles(id, preferred_name, person_name)").eq("user_id", user.id).eq("status", "active"),
    parent ? supabase.from("schedule_changes").select("*").eq("circle_id", circle.id).eq("status", "requested").order("start_date") : Promise.resolve({ data: [] }),
    parent ? supabase.from("expenses").select("*").eq("circle_id", circle.id) : Promise.resolve({ data: [] }),
    parent ? supabase.from("settlements").select("*").eq("circle_id", circle.id) : Promise.resolve({ data: [] }),
    parent ? supabase.from("agreements").select("*").eq("circle_id", circle.id).eq("status", "proposed") : Promise.resolve({ data: [] }),
  ]);
  const tasks = (tasksR.data || []) as Task[];
  const appts = ((apptsR.data || []) as Appointment[]).filter((a) => (a.end_date || a.date) >= t);
  const changes = (reqR.data || []) as ScheduleChange[];
  const expenses = (expR.data || []) as Expense[];
  const proposals = (agR.data || []) as Agreement[];
  const forMe = {
    changes: changes.filter((c) => c.requested_by !== user.id),
    mine: changes.filter((c) => c.requested_by === user.id),
    expenses: expenses.filter((e) => e.status === "pending" && e.created_by !== user.id && e.paid_by !== user.id && e.split_between.includes(user.id)),
    agreements: proposals.filter((a) => a.proposed_by !== user.id),
  };
  const net = balances(expenses, (setR.data || []) as Settlement[])[user.id] || 0;

  // Status: coordination only
  const reasons: string[] = [];
  let level = 0;
  for (const a of appts) if (a.needs_transport && !a.driver && a.date >= t && a.date <= addDays(t, 2)) { level = 2; reasons.push(`No one is taking ${childNames(a.child_ids, kids) || "them"} to ${a.title} ${dayLabel(a.date).toLowerCase()}`); }
  const waiting = forMe.changes.length + forMe.expenses.length + forMe.agreements.length;
  if (waiting) { level = Math.max(level, 1); reasons.push(`${waiting} thing${waiting === 1 ? "" : "s"} waiting for your answer`); }
  for (const x of tasks) {
    if (isOverdue(x)) { level = Math.max(level, 1); reasons.push(`${x.title} is overdue`); }
    else if (!x.assignee && x.due_date && x.due_date <= addDays(t, 3) && !x.appointment_id) { level = Math.max(level, 1); reasons.push(`${x.title} needs someone`); }
  }
  if (parent) for (const k of kids) if (k.passport_expiry && k.passport_expiry <= addDays(t, 183)) { level = Math.max(level, 1); reasons.push(`${k.first_name}'s passport ${k.passport_expiry < t ? "has expired" : `expires ${new Date(k.passport_expiry + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`}`); }
  const labels = ["All good", "Attention needed", "Urgent family action"];
  const cls = ["good", "attn", "urgent"][level];

  const upcoming: Row[] = [];
  for (let i = 1; i <= 14 && upcoming.length < 8; i++) {
    const d = addDays(t, i);
    const n = fam.nightOf(d), prev = fam.nightOf(addDays(d, -1));
    if (fam.twoHomes && n?.household_id && prev?.household_id && n.household_id !== prev.household_id) {
      const h = fam.home(n.household_id);
      upcoming.push({ kind: "transport", title: `Handover to ${h?.name}`, sub: <>{dayLabel(d)}{circle.handover_note ? ` · ${circle.handover_note}` : ""}</>, href: `${base}/handover` });
    }
    dayRows(d, tasks, appts.filter((a) => a.date === d), kids, ctx, base).forEach((r) => upcoming.push({ ...r, when: undefined, sub: <>{dayLabel(d)}{r.when ? ` · ${r.when}` : ""} · {r.sub}</> }));
  }
  const need = tasks.filter((x) => isOverdue(x) || (!x.assignee && x.due_date && x.due_date <= addDays(t, 7)));
  const circles = (circlesR.data || []).map((r) => r.care_circles as unknown as { id: string; preferred_name: string; person_name: string });
  const me = members.find((m) => m.user_id === user.id);
  const label = kidsLabel(kids);

  return (
    <main className="page">
      <Header title={circle.person_name} sub={`${label} · ${longDate(t)}`} initial={(me?.profiles?.display_name || "?")[0]} />
      {circles.length > 1 && (
        <div className="circles">{circles.map((c) => <Link key={c.id} href={`/c/${c.id}`} className="cchip" aria-current={c.id === circle.id}><b>{c.person_name}</b></Link>)}</div>
      )}
      <Notice sp={sp} />
      {fam.twoHomes || fam.households.length >= 2 ? <Tonight fam={fam} label={label} base={base} note={circle.handover_note} /> : null}
      {fam.twoHomes && <Strip fam={fam} base={base} />}

      <section className={`status ${cls}`} aria-live="polite">
        <div className="sline"><span className="dot" />{labels[level]}</div>
        {reasons.length ? <ul>{reasons.slice(0, 5).map((r) => <li key={r}>{r}</li>)}</ul> : <p style={{ color: "var(--ink)" }}>Everything coming up has someone looking after it.</p>}
      </section>

      {parent && waiting > 0 && (
        <section className="stack">
          <h2>Waiting for your answer</h2>
          {forMe.changes.map((c) => (
            <div key={c.id} className="card pad reqcard">
              <span className="label">Schedule change</span>
              <b>{nameOf(c.requested_by)} asks: {c.start_date === c.end_date ? dayLabel(c.start_date) : `${dayLabel(c.start_date)} to ${dayLabel(c.end_date)}`} at {fam.home(c.household_id)?.name}</b>
              {c.reason && <p className="small">&ldquo;{c.reason}&rdquo;</p>}
              {c.in_return && <p className="small muted">In return: {c.in_return}</p>}
              <form action={respondChange} className="stack">
                <Hidden circle={circle.id} id={c.id} ret="/" />
                <label className="fl"><span className="sr-only">Note</span><input name="note" placeholder="Add a note (optional)" maxLength={500} /></label>
                <div className="row"><button name="answer" value="yes" className="btn primary sm">Agree</button><button name="answer" value="no" className="btn sm">Say no</button></div>
              </form>
            </div>
          ))}
          {forMe.expenses.map((e) => (
            <Link key={e.id} href={`${base}/costs#pending`} className="card pad reqcard" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="label">Shared cost to approve</span>
              <b>{e.description} · {money(e.amount_pence)}</b>
              <span className="small muted">{nameOf(e.paid_by)} paid. Your share {money(sharesOf(e)[user.id] || 0)}. <KidChips ids={e.child_ids} kids={kids} /></span>
            </Link>
          ))}
          {forMe.agreements.map((a) => (
            <Link key={a.id} href={`${base}/agreements`} className="card pad reqcard" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="label">Proposed agreement</span>
              <b>{a.title}</b><span className="small muted">From {nameOf(a.proposed_by)}</span>
            </Link>
          ))}
        </section>
      )}

      <nav className="chips" aria-label="Quick links">
        {fam.twoHomes && <Link href={`${base}/schedule`} className="chip">Schedule</Link>}
        <Link href={`${base}/children`} className="chip">Children</Link>
        {parent && <Link href={`${base}/costs`} className="chip">Costs{net ? ` · ${net > 0 ? `owed ${money(net)}` : `you owe ${money(-net)}`}` : ""}</Link>}
        {parent && <Link href={`${base}/agreements`} className="chip">Agreements</Link>}
        {parent && <Link href={`${base}/letters`} className="chip">Read a school letter</Link>}
        <Link href={`${base}/playbooks`} className="chip">Playbooks</Link>
      </nav>

      <section className="stack">
        <div className="row between"><h2>Today</h2><Link href={`${base}/calendar`} className="link">Calendar</Link></div>
        <Rows rows={dayRows(t, tasks, appts, kids, ctx, base)} empty="Nothing planned today." />
      </section>

      <section className="stack">
        <div className="row between"><h2>Needs attention</h2><Link href={`${base}/tasks`} className="link">All tasks</Link></div>
        <Rows rows={need.map((x) => ({ kind: kindOf(x), when: dayLabel(x.due_date).split(" ")[0], title: x.title, href: `${base}/tasks/${x.id}`,
          sub: <>{isOverdue(x) && <span className="tag over">Overdue</span>} <KidChips ids={x.child_ids} kids={kids} /> {x.assignee ? nameOf(x.assignee) : <span className="tag unas">Who can do this?</span>}</> }))} empty="Nothing needs attention." />
      </section>

      <section className="stack">
        <div className="row between"><h2>Next two weeks</h2>{parent && <Link href={`${base}/appointments/new`} className="link">Add event</Link>}</div>
        <Rows rows={upcoming} empty="Nothing booked yet." />
      </section>

      {parent && forMe.mine.length > 0 && (
        <p className="small muted">You have {forMe.mine.length} schedule request{forMe.mine.length === 1 ? "" : "s"} waiting for an answer. <Link href={`${base}/schedule`}>View</Link></p>
      )}

      <section className="stack">
        <div className="row between"><h2>Recent activity</h2><Link href={`${base}/more/activity`} className="link">See all</Link></div>
        <div className="card list">
          {((actR.data || []) as Activity[]).map((a) => (
            <div key={a.id} className="item"><span className="avatar sm">{nameOf(a.actor)[0]}</span>
              <span className="main"><span><b>{nameOf(a.actor)}</b> {a.verb}{a.subject ? ` ${a.subject}` : ""}</span><span className="s">{when(a.created_at)}</span></span></div>
          ))}
          {!actR.data?.length && <p className="empty">Nothing yet.</p>}
        </div>
      </section>
      <Disclaimer />
    </main>
  );
}

// ---------------------------------------------------------------- childminders, nannies, clubs
export async function KidsHelperHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { supabase, circle, user, members } = ctx;
  const base = `/c/${circle.id}`;
  const t = today();
  const fam = await loadFamily(supabase, circle.id, { from: t, days: 8 });
  const [{ data: tasks }, { data: open }, { data: appts }, { data: rules }, { data: contacts }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).eq("assignee", user.id).in("status", ["open", "accepted"]).order("due_date").limit(12),
    supabase.from("checkins").select("*").eq("circle_id", circle.id).eq("user_id", user.id).is("checked_out_at", null).order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("appointments").select("*").eq("circle_id", circle.id).gte("date", addDays(t, -14)).lte("date", addDays(t, 30)).order("date"),
    supabase.from("agreements").select("*").eq("circle_id", circle.id).eq("status", "agreed"),
    supabase.from("contacts").select("*").eq("circle_id", circle.id).order("category"),
  ]);
  const parents = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  const me = members.find((m) => m.user_id === user.id);
  const kids = fam.children;
  return (
    <main className="page">
      <Header title={`Hello ${(me?.profiles?.display_name || "").split(" ")[0]}`} sub={`Your pick-ups for ${kidsLabel(kids)}`} initial={(me?.profiles?.display_name || "?")[0]} />
      <Notice sp={sp} />
      <section className="card pad" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        {open ? (
          <><div><b>You&apos;re checked in</b><p className="small muted">Since {timeOf(open.checked_in_at)}</p></div>
            <form action={checkOut}><Hidden circle={circle.id} /><button className="btn primary">Check out</button></form></>
        ) : (
          <><div><b>Collected the children?</b><p className="small muted">Check in so their parents know.</p></div>
            <Link href={`${base}/checkin`} className="btn primary">Check in</Link></>
        )}
      </section>
      <section className="stack"><h2>Your pick-ups</h2>
        <Rows rows={((tasks || []) as Task[]).map((x) => ({ kind: kindOf(x), title: x.title, href: `${base}/tasks/${x.id}`,
          sub: <>{dayLabel(x.due_date)}{x.due_time ? ` at ${hm(x.due_time)}` : ""} <KidChips ids={x.child_ids} kids={kids} /></> }))} empty="Nothing booked with you." />
      </section>
      {fam.twoHomes && (
        <section className="stack"><h2>Which home after pick-up</h2>
          <div className="card list">
            {Array.from({ length: 7 }, (_, i) => addDays(t, i)).map((d) => {
              const h = fam.home(fam.nightOf(d)?.household_id);
              return <div key={d} className={`item col-${h?.colour || "none"}`}><span className="bar" style={{ background: "var(--c)" }} /><span className="when">{dayLabel(d).split(" ")[0]}</span>
                <span className="main"><span className="t">{h?.name || "Not set"}</span>{h?.address && <span className="s">{h.address.replace(/\n/g, ", ")}</span>}</span></div>;
            })}
          </div>
        </section>
      )}
      <section className="stack"><h2>The children</h2>
        {kids.map((k) => (
          <div key={k.id} className="card pad">
            <div className="row"><span className={`kid col-${k.colour}`}>{k.first_name}</span><span className="small muted">{ageOn(k.date_of_birth) !== null ? `Age ${ageOn(k.date_of_birth)}` : ""}{k.school ? ` · ${k.school}` : ""}{k.class_name ? `, ${k.class_name}` : ""}</span></div>
            <dl className="kv" style={{ padding: 0 }}>
              <dt>Allergies</dt><dd>{k.allergies || "None recorded"}</dd>
              {k.important_notes && <><dt>Important</dt><dd>{k.important_notes}</dd></>}
            </dl>
          </div>
        ))}
      </section>
      {(appts || []).length > 0 && (
        <section className="stack"><h2>Dates to know</h2>
          <Rows rows={((appts || []) as Appointment[]).filter((a) => (a.end_date || a.date) >= t).map((a) => ({ kind: "appointment", title: a.title, href: `${base}/appointments/${a.id}`,
            sub: <>{a.end_date ? `${dayLabel(a.date)} to ${dayLabel(a.end_date)}` : dayLabel(a.date)} <KidChips ids={a.child_ids} kids={kids} /></> }))} empty="" />
        </section>
      )}
      {(rules || []).length > 0 && (
        <section className="stack"><h2>Rules in both homes</h2>
          <div className="card list">{((rules || []) as Agreement[]).map((r) => <div key={r.id} className="item"><span className="main"><span className="t">{r.title}</span>{r.detail && <span className="s">{r.detail}</span>}</span></div>)}</div>
        </section>
      )}
      <section className="stack"><h2>Contacts</h2>
        <div className="card list">
          {parents.map((m) => <div key={m.user_id} className="item"><span className="main"><span className="t">{m.profiles?.display_name} <span className="muted">· {m.relationship}</span></span><span className="s phone">{m.profiles?.phone || "No number added"}</span></span></div>)}
          {(contacts || []).map((c) => <div key={c.id} className="item"><span className="main"><span className="t">{c.name}</span><span className="s">{[c.category, c.organisation].filter(Boolean).join(" · ")}</span>{c.phone && <span className="s phone">{c.phone}</span>}{c.notes && <span className="s">{c.notes}</span>}</span></div>)}
        </div>
      </section>
      <p className="note">You can see what you need for pick-ups. Money, private notes and family messages stay with the parents.</p>
      <p className="disclaimer">In an emergency call 999. For urgent medical advice call NHS 111.</p>
    </main>
  );
}

// ---------------------------------------------------------------- young person (13+)
export async function YoungPersonHome({ ctx, sp }: { ctx: Ctx; sp: Record<string, string> }) {
  const { supabase, circle, user, members } = ctx;
  const t = today();
  const fam = await loadFamily(supabase, circle.id, { from: addDays(t, -1), days: 15 });
  const me = fam.children.find((k) => k.user_id === user.id);
  const [{ data: tasks }, { data: appts }, { data: rules }, { data: items }] = await Promise.all([
    supabase.from("tasks").select("*").eq("circle_id", circle.id).in("status", ["open", "accepted"]).lte("due_date", addDays(t, 7)).order("due_date"),
    supabase.from("appointments").select("*").eq("circle_id", circle.id).gte("date", addDays(t, -14)).lte("date", addDays(t, 14)).order("date"),
    supabase.from("agreements").select("*").eq("circle_id", circle.id).eq("status", "agreed"),
    supabase.from("child_items").select("*").eq("circle_id", circle.id),
  ]);
  const tonight = fam.home(fam.nightOf(t)?.household_id);
  const next = nextHandover(fam.nights);
  const nextHome = fam.home(next?.to);
  const mine = ((items || []) as ChildItem[]).filter((i) => !i.child_id || i.child_id === me?.id);
  const myAppts = ((appts || []) as Appointment[]).filter((a) => (a.end_date || a.date) >= t && (!a.child_ids?.length || (me && a.child_ids.includes(me.id))));
  const name = me?.first_name || (members.find((m) => m.user_id === user.id)?.profiles?.display_name || "").split(" ")[0];
  const parents = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  return (
    <main className="page sp" style={{ fontSize: 18 }}>
      <div className="top"><div><span className="brand">KIN</span><h1>Hi {name}</h1><p className="muted">{longDate(t)}</p></div></div>
      <Notice sp={sp} />
      {tonight ? (
        <section className={`yp-tonight col-${tonight.colour}`}>
          <span className="label">Tonight you&apos;re at</span><b>{tonight.name}</b>
          {next && nextHome && <span>Then {nextHome.name} from <strong>{dayLabel(next.date)}</strong>{circle.handover_note ? ` (${circle.handover_note.toLowerCase()})` : ""}</span>}
        </section>
      ) : null}
      {fam.twoHomes && <Strip fam={fam} days={14} />}
      {next && nextHome && (circle.packing_list || []).length > 0 && (
        <section className="card pad">
          <h2>Pack for {nextHome.name}, {dayLabel(next.date).toLowerCase()}</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{(circle.packing_list || []).map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      )}
      <section className="stack"><h2>Coming up for you</h2>
        <div className="card list">
          {myAppts.map((a) => <div key={a.id} className="item k-appointment"><span className="bar" /><span className="main"><span className="t">{a.title}</span><span className="s">{a.end_date ? `${dayLabel(a.date)} to ${dayLabel(a.end_date)}` : `${dayLabel(a.date)}${a.time ? ` at ${hm(a.time)}` : ""}`}{a.location ? ` · ${a.location}` : ""}</span></span></div>)}
          {((tasks || []) as Task[]).map((x) => <div key={x.id} className="item k-task"><span className="bar" /><span className="main"><span className="t">{x.title}</span><span className="s">{dayLabel(x.due_date)}{x.due_time ? ` at ${hm(x.due_time)}` : ""}{x.assignee && x.assignee !== user.id ? ` · ${ctx.nameOf(x.assignee)}` : ""}</span></span></div>)}
          {!myAppts.length && !tasks?.length && <p className="empty">Nothing this week.</p>}
        </div>
      </section>
      {mine.length > 0 && (
        <section className="stack"><h2>Where is it?</h2>
          <div className="card list">{mine.map((i) => <div key={i.id} className="item"><span className="main"><span className="t">{i.name}</span><span className="s">{fam.home(i.household_id)?.name || "Somewhere else"}{i.location_note ? ` · ${i.location_note}` : ""}</span></span></div>)}</div>
        </section>
      )}
      {(rules || []).length > 0 && (
        <section className="stack"><h2>Rules in both homes</h2>
          <div className="card list">{((rules || []) as Agreement[]).map((r) => <div key={r.id} className="item"><span className="main"><span className="t">{r.title}</span>{r.detail && <span className="s">{r.detail}</span>}</span></div>)}</div>
        </section>
      )}
      <form action={youngPersonAsk} className="card pad form">
        <Hidden circle={circle.id} />
        <h2>Need something?</h2>
        <label className="fl" style={{ fontSize: 16 }}>Tell your parents<input name="message" maxLength={200} placeholder="e.g. £3 for non-uniform day on Friday" /></label>
        <button className="btn primary">Send</button>
      </form>
      <section className="card pad">
        <b>Your parents</b>
        {parents.map((m) => <p key={m.user_id}>{m.profiles?.display_name}: <span className="phone">{m.profiles?.phone || "no number added"}</span></p>)}
      </section>
      <section className="card pad">
        <b>Want to talk to someone?</b>
        <p className="small">Childline is free and confidential, for anyone under 19. Call <span className="phone">0800 1111</span> or visit childline.org.uk.</p>
      </section>
      <p className="disclaimer">In an emergency, call 999.</p>
    </main>
  );
}

