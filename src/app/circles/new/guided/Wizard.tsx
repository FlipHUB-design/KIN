"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CARE_NEEDS, PATTERNS, roleDesc, roleLabel, type Kind, type Role } from "@/lib/kin";
import type { Answers, CareAnswers, Helper, KidAnswers, Plan, PlanTask } from "@/lib/setup";
import { applySetup, draftSetup } from "./actions";

const KID_ROLES: Role[] = ["admin", "contributor", "helper", "supported"];
const CARE_ROLES: Role[] = ["family", "contributor", "helper", "supported"];
const KID_QUICK: [string, string, Role][] = [["Other parent", "Dad", "admin"], ["Grandparent", "Grandma", "contributor"], ["Childminder or nanny", "Childminder", "helper"], ["Step-parent", "Step-parent", "contributor"], ["Child aged 13 or over", "Daughter", "supported"]];
const CARE_QUICK: [string, string, Role][] = [["Brother or sister", "Brother", "family"], ["Grandchild", "Grandson", "contributor"], ["Neighbour", "Neighbour", "helper"], ["Cleaner or carer", "Cleaner", "helper"]];

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
function whenText(t: PlanTask) {
  const time = t.due_time ? `, ${t.due_time}` : "";
  const wd = fmt(t.due_date, { weekday: "long" });
  switch (t.recurrence) {
    case "weekly": return `Every ${wd}${time}, from ${fmt(t.due_date, { day: "numeric", month: "short" })}`;
    case "fortnightly": return `Every other ${wd}${time}, from ${fmt(t.due_date, { day: "numeric", month: "short" })}`;
    case "monthly": return `Monthly from ${fmt(t.due_date, { day: "numeric", month: "short" })}`;
    case "daily": return `Every day${time}`;
    case "annually": return `Every year on ${fmt(t.due_date, { day: "numeric", month: "long" })}`;
    default: return `${fmt(t.due_date, { weekday: "short", day: "numeric", month: "short" })}${time}`;
  }
}

function People({ kind, people, set }: { kind: Kind; people: Helper[]; set: (p: Helper[]) => void }) {
  const roles = kind === "children" ? KID_ROLES : CARE_ROLES;
  const quick = kind === "children" ? KID_QUICK : CARE_QUICK;
  const upd = (i: number, k: keyof Helper, v: string) => set(people.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  return (
    <div className="stack">
      <div className="row">{quick.map(([label, rel, role]) => (
        <button type="button" key={label} className="btn sm" onClick={() => set([...people, { name: "", email: "", relationship: rel, role }])}>+ {label}</button>
      ))}</div>
      {people.map((p, i) => (
        <div key={i} className="card pad stack">
          <div className="two">
            <label className="fl">Name<input value={p.name} onChange={(e) => upd(i, "name", e.target.value)} autoFocus={!p.name} /></label>
            <label className="fl">They are…<input value={p.relationship} onChange={(e) => upd(i, "relationship", e.target.value)} placeholder="e.g. Grandma" /></label>
          </div>
          <label className="fl">What they can see<select value={p.role} onChange={(e) => upd(i, "role", e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{roleLabel(r, kind)}</option>)}</select>
            <span className="note">{roleDesc(p.role, kind)}</span></label>
          <label className="fl">Email (optional)<input type="email" value={p.email} onChange={(e) => upd(i, "email", e.target.value)} />
            <span className="note">We&apos;ll email them an invitation link. Without one, you&apos;ll get a link to send yourself.</span></label>
          <button type="button" className="link" onClick={() => set(people.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {!people.length && <p className="note">No one else yet? That&apos;s fine. You can invite people any time.</p>}
    </div>
  );
}

export default function Wizard({ kind, monday, aiReady }: { kind: Kind; monday: string; aiReady: boolean }) {
  const [step, setStep] = useState(0);
  const [kid, setKid] = useState<KidAnswers>({ kind: "children", relationship: "", familyName: "", children: [{ name: "", dob: "", school: "", allergies: "" }], twoHomes: true, homeA: "", homeB: "", pattern: "2255", anchor: monday, handover: "", people: [], week: "", extra: "" });
  const [care, setCare] = useState<CareAnswers>({ kind: "care", person: "", preferred: "", relationship: "", address: "", dob: "", needs: [], checkin: "", people: [], week: "", extra: "" });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const kids = kind === "children";
  const a: Answers = kids ? kid : care;
  const steps = kids ? ["Your children", "Homes", "Who helps", "Your week", "Check and finish"] : ["Who you help", "Help needed", "Who helps", "Their week", "Check and finish"];

  const next = () => {
    setError("");
    if (step === 0 && kids && !kid.children.some((c) => c.name.trim())) return setError("Add at least one child's first name.");
    if (step === 0 && kids && !kid.relationship.trim()) return setError("Tell us who you are to them, for example Mum.");
    if (step === 0 && !kids && (!care.person.trim() || !care.relationship.trim())) return setError("Add their name and who you are to them.");
    if (step === 3) {
      start(async () => {
        const d = await draftSetup(a);
        setPlan(d.plan); setNote(d.note); setStep(4); window.scrollTo(0, 0);
      });
      return;
    }
    setStep(step + 1); window.scrollTo(0, 0);
  };
  const tog = <K extends "people" | "tasks" | "contacts" | "playbooks">(k: K, i: number) =>
    setPlan((p) => p && ({ ...p, [k]: (p[k] as { include: boolean }[]).map((x, j) => (j === i ? { ...x, include: !x.include } : x)) }));

  return (
    <main className="page">
      <Link href="/circles/new" className="link">‹ Back</Link>
      <ol className="steps" aria-label="Progress">{steps.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>{s}</li>)}</ol>
      {error && <p className="error" role="alert">{error}</p>}

      {kids && step === 0 && (
        <section className="form">
          <h1>Tell us about your children</h1>
          <p className="muted">Just the basics. You can add more later.</p>
          <div className="two">
            <label className="fl">You are their…<input value={kid.relationship} onChange={(e) => setKid({ ...kid, relationship: e.target.value })} placeholder="e.g. Mum" /></label>
            <label className="fl">Family name (optional)<input value={kid.familyName} onChange={(e) => setKid({ ...kid, familyName: e.target.value })} placeholder="e.g. The Carter family" /></label>
          </div>
          {kid.children.map((c, i) => (
            <div key={i} className="card pad stack">
              <div className="two">
                <label className="fl">First name<input value={c.name} onChange={(e) => setKid({ ...kid, children: kid.children.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></label>
                <label className="fl">Date of birth<input type="date" value={c.dob} onChange={(e) => setKid({ ...kid, children: kid.children.map((x, j) => (j === i ? { ...x, dob: e.target.value } : x)) })} /></label>
              </div>
              <div className="two">
                <label className="fl">School (optional)<input value={c.school} onChange={(e) => setKid({ ...kid, children: kid.children.map((x, j) => (j === i ? { ...x, school: e.target.value } : x)) })} /></label>
                <label className="fl">Allergies (optional)<input value={c.allergies} onChange={(e) => setKid({ ...kid, children: kid.children.map((x, j) => (j === i ? { ...x, allergies: e.target.value } : x)) })} placeholder="e.g. Nuts" /></label>
              </div>
              {kid.children.length > 1 && <button type="button" className="link" onClick={() => setKid({ ...kid, children: kid.children.filter((_, j) => j !== i) })}>Remove</button>}
            </div>
          ))}
          {kid.children.length < 6 && <button type="button" className="btn" onClick={() => setKid({ ...kid, children: [...kid.children, { name: "", dob: "", school: "", allergies: "" }] })}>+ Add another child</button>}
          <p className="note">Allergies are shown to everyone you invite, including childminders, so they can keep the children safe.</p>
        </section>
      )}

      {kids && step === 1 && (
        <section className="form">
          <h1>Where do they live?</h1>
          <div className="choice">
            <label><input type="radio" checked={kid.twoHomes} onChange={() => setKid({ ...kid, twoHomes: true })} /><span>Across two homes</span></label>
            <label><input type="radio" checked={!kid.twoHomes} onChange={() => setKid({ ...kid, twoHomes: false })} /><span>One home</span></label>
          </div>
          {kid.twoHomes && <>
            <div className="two">
              <label className="fl">Your home is called<input value={kid.homeA} onChange={(e) => setKid({ ...kid, homeA: e.target.value })} placeholder="e.g. Mum's" /></label>
              <label className="fl">The other home<input value={kid.homeB} onChange={(e) => setKid({ ...kid, homeB: e.target.value })} placeholder="e.g. Dad's" /></label>
            </div>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>Which is closest to your usual pattern?</legend>
              {PATTERNS.map((p) => (
                <label key={p.key} className={`card pad pick${kid.pattern === p.key ? " on" : ""}`}>
                  <input type="radio" name="pattern" checked={kid.pattern === p.key} onChange={() => setKid({ ...kid, pattern: p.key })} />
                  <span><b>{p.label}</b><span className="small muted">{p.desc}</span></span>
                </label>
              ))}
              <span className="note">Pick the closest. You can change single nights later, and swaps are agreed in the app.</span>
            </fieldset>
            <label className="fl">The pattern&apos;s week 1 starts on (a Monday)<input type="date" value={kid.anchor} onChange={(e) => setKid({ ...kid, anchor: e.target.value })} /></label>
            <label className="fl">Usual handover (optional)<input value={kid.handover} onChange={(e) => setKid({ ...kid, handover: e.target.value })} placeholder="e.g. School pick-up, or 5:30pm at Mum's" /></label>
          </>}
        </section>
      )}

      {!kids && step === 0 && (
        <section className="form">
          <h1>Who are you helping?</h1>
          <label className="fl">Their full name<input value={care.person} onChange={(e) => setCare({ ...care, person: e.target.value })} placeholder="e.g. Margaret Hale" /></label>
          <div className="two">
            <label className="fl">What do you call them?<input value={care.preferred} onChange={(e) => setCare({ ...care, preferred: e.target.value })} placeholder="e.g. Mum" /></label>
            <label className="fl">You are their…<input value={care.relationship} onChange={(e) => setCare({ ...care, relationship: e.target.value })} placeholder="e.g. Daughter" /></label>
          </div>
          <label className="fl">Date of birth (optional)<input type="date" value={care.dob} onChange={(e) => setCare({ ...care, dob: e.target.value })} />
            <span className="note">Helps KIN suggest guides, such as Attendance Allowance.</span></label>
          <label className="fl">Their address (optional)<textarea value={care.address} onChange={(e) => setCare({ ...care, address: e.target.value })} />
            <span className="note">Shown to anyone who visits, including helpers.</span></label>
        </section>
      )}

      {!kids && step === 1 && (
        <section className="form">
          <h1>What does {care.preferred || care.person.split(" ")[0] || "they"} need help with?</h1>
          <p className="muted">Tick everything that applies. KIN sets up the regular jobs for you.</p>
          <div className="grid2">{CARE_NEEDS.map((n) => (
            <label key={n.key} className={`card pad pick${care.needs.includes(n.key) ? " on" : ""}`}>
              <input type="checkbox" checked={care.needs.includes(n.key)} onChange={() => setCare({ ...care, needs: care.needs.includes(n.key) ? care.needs.filter((x) => x !== n.key) : [...care.needs, n.key] })} />
              <span><b>{n.label}</b></span>
            </label>
          ))}</div>
          <label className="fl">Does someone usually check in by a certain time? (optional)<input type="time" value={care.checkin} onChange={(e) => setCare({ ...care, checkin: e.target.value })} />
            <span className="note">KIN shows when nobody has checked in by then. It never contacts emergency services.</span></label>
        </section>
      )}

      {step === 2 && (
        <section className="form">
          <h1>Who else helps?</h1>
          <p className="muted">Each person only sees what their role allows. Nothing is sent until you finish.</p>
          <People kind={kind} people={a.people} set={(people) => (kids ? setKid({ ...kid, people }) : setCare({ ...care, people }))} />
        </section>
      )}

      {step === 3 && (
        <section className="form">
          <h1>{kids ? "What does a normal week look like?" : `What does ${care.preferred ? care.preferred + "'s" : care.person ? care.person.split(" ")[0] + "'s" : "their"} week look like?`}</h1>
          <p className="muted">Write it how you&apos;d say it. {aiReady ? "KIN's AI helper turns it into jobs, dates and contacts for you to check." : "This helps you set things up later."}</p>
          <label className="fl">Regular things
            <textarea rows={5} value={a.week} onChange={(e) => (kids ? setKid({ ...kid, week: e.target.value }) : setCare({ ...care, week: e.target.value }))}
              placeholder={kids ? "e.g. Alfie has swimming at Mounts Baths on Tuesdays at 4:30. Ruby does drama on Thursdays. Grandma does tea on Wednesdays. Kelly collects Alfie on Mondays and Tuesdays." : "e.g. Helen cleans on Fridays 10 till 12. Anthony does the shopping on Saturdays. I call Mum every evening. Bins go out on Thursday night."} /></label>
          <label className="fl">Anything coming up, or worth knowing?
            <textarea rows={4} value={a.extra} onChange={(e) => (kids ? setKid({ ...kid, extra: e.target.value }) : setCare({ ...care, extra: e.target.value }))}
              placeholder={kids ? "e.g. Ruby's passport runs out in March. School trip to the farm on 16 October. Alfie needs his inhaler at both homes." : "e.g. Hospital appointment on 14 October at 10am, needs a lift. She's hard of hearing. GP is Orchard Lane Surgery."} /></label>
          <p className="note">Leave these blank if you like. {aiReady ? "What you write here is read by KIN's AI helper to draft your setup." : ""}</p>
        </section>
      )}

      {step === 4 && plan && (
        <section className="stack">
          <h1>Here&apos;s your setup</h1>
          {plan.summary && <p>{plan.summary}</p>}
          {note && <p className="note">{note}</p>}
          <p className="muted">Untick anything you don&apos;t want. You can change everything later.</p>

          <div className="card pad stack">
            <h2>{kids ? plan.person_name : `${plan.preferred_name}'s Care Circle`}</h2>
            {kids ? plan.children.map((c) => (
              <p key={c.first_name} className="small"><b>{c.first_name}</b>{c.school ? ` · ${c.school}` : ""}{c.allergies ? ` · Allergies: ${c.allergies}` : ""}{c.important_notes ? ` · ${c.important_notes}` : ""}</p>
            )) : <>
              {plan.address && <p className="small">Address: {plan.address}</p>}
              {plan.checkin_by && <p className="small">Daily check-in by {plan.checkin_by}</p>}
              {plan.important_notes && <p className="small">Good to know: {plan.important_notes}</p>}
              {plan.allergies && <p className="small">Allergies: {plan.allergies}</p>}
            </>}
            {kids && plan.homes.length === 2 && <p className="small">Homes: {plan.homes.join(" and ")} · {PATTERNS.find((x) => x.key === plan.pattern)?.label || "No regular pattern"}</p>}
          </div>

          {plan.people.length > 0 && <>
            <h2>Invite</h2>
            <div className="card list">{plan.people.map((p, i) => (
              <label key={i} className="item checkrow"><input type="checkbox" checked={p.include} onChange={() => tog("people", i)} />
                <span className="main"><span className="t">{p.name} · {p.relationship}</span><span className="s">{roleLabel(p.role, kind)}{p.email ? ` · invitation emailed to ${p.email}` : " · you'll get a link to send"}</span></span></label>
            ))}</div>
          </>}

          {plan.tasks.length > 0 && <>
            <h2>Jobs and dates</h2>
            <div className="card list">{plan.tasks.map((t, i) => (
              <label key={i} className="item checkrow"><input type="checkbox" checked={t.include} onChange={() => tog("tasks", i)} />
                <span className="main"><span className="t">{t.title}</span>
                  <span className="s">{whenText(t)}{t.children.length ? ` · ${t.children.join(", ")}` : ""}{t.who === "me" ? " · You" : t.who ? ` · ${t.who}, once they join` : " · Anyone can take it"}{t.note ? ` · ${t.note}` : ""}</span></span></label>
            ))}</div>
          </>}

          {plan.contacts.length > 0 && <>
            <h2>Contacts</h2>
            <div className="card list">{plan.contacts.map((c, i) => (
              <label key={i} className="item checkrow"><input type="checkbox" checked={c.include} onChange={() => tog("contacts", i)} />
                <span className="main"><span className="t">{c.name}</span><span className="s">{[c.category, c.organisation, c.phone].filter(Boolean).join(" · ")}</span></span></label>
            ))}</div>
          </>}

          {kids && plan.homes.length === 2 && <>
            <h2>Handover checklist</h2>
            <label className="fl"><span className="note">One item per line</span>
              <textarea rows={4} value={plan.packing_list.join("\n")} onChange={(e) => setPlan({ ...plan, packing_list: e.target.value.split("\n") })} /></label>
          </>}

          <h2>Step-by-step guides</h2>
          <p className="note">Ticked guides add their steps as jobs.</p>
          <div className="card list">{plan.playbooks.map((p, i) => (
            <label key={p.slug} className="item checkrow"><input type="checkbox" checked={p.include} onChange={() => tog("playbooks", i)} />
              <span className="main"><span className="t">{p.title}</span></span></label>
          ))}</div>

          <button className="btn primary block" disabled={busy} onClick={() => start(async () => { await applySetup({ ...plan, packing_list: plan.packing_list.map((x) => x.trim()).filter(Boolean) }); })}>
            {busy ? "Setting up…" : kids ? "Set up our family" : "Set up the Care Circle"}</button>
          <button className="btn block" disabled={busy} onClick={() => setStep(3)}>Back to the questions</button>
        </section>
      )}

      {step < 4 && (
        <div className="row" style={{ marginTop: 16 }}>
          {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={next} disabled={busy}>
            {busy ? (aiReady ? "Drafting your setup…" : "Preparing…") : step === 3 ? "Draft my setup" : "Next"}</button>
        </div>
      )}
    </main>
  );
}
