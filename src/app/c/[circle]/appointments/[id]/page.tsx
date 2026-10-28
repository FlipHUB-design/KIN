import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, hm, isInner, longDate, today, type Appointment } from "@/lib/kin";
import Questions from "@/components/Questions";
import Recordings from "@/components/Recordings";
import Recorder from "@/components/Recorder";
import { transcribeOn } from "@/lib/transcribe";
import { isDemoEmail } from "@/lib/notify";
import { Hidden, Notice } from "@/components/ui";
import { claimTask, deleteAppointment, savePack } from "../../actions";
import Thread from "@/components/Thread";

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, circle, user } = await getCircle(cid);
  const kidsMode = circle.kind === "children";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!data) notFound();
  const a = data as Appointment;
  const inner = isInner(role, circle.kind) && !kidsMode;
  const { data: tr } = await supabase.from("tasks").select("id, assignee, status").eq("appointment_id", id).maybeSingle();
  return (
    <main className="page">
      <Link href={`/c/${cid}/calendar?d=${a.date}`} className="link">‹ Calendar</Link>
      <Notice sp={sp} />
      <div className="row k-appointment"><span className="tag">{kidsMode ? "Event" : "Appointment"}</span>{a.private && <span className="tag">Parents only</span>}{a.share_with_helpers && <span className="tag">Shared with childminders</span>}
        {kidsMode && <KidTags supabase={supabase} cid={cid} ids={a.child_ids || []} />}</div>
      <h1>{a.title}</h1>
      <p className="muted">{longDate(a.date)}{a.end_date ? ` to ${longDate(a.end_date)}` : ""}{a.time ? ` at ${hm(a.time)}` : ""}</p>
      <div className="card"><dl className="kv">
        <dt>Where</dt><dd>{a.location || "Not set"}</dd>
        <dt>Attending</dt><dd>{a.attending || "Not set"}</dd>
        <dt>{kidsMode ? "Taking them" : "Transport"}</dt><dd>{a.needs_transport ? (a.driver ? `${nameOf(a.driver)} ${nameOf(a.driver) === "You" ? "are" : "is"} ${kidsMode ? "taking them" : "driving"}` : kidsMode ? "No one yet" : "No driver yet") : "Not needed"}</dd>
        {a.notes && canEdit(role) && <><dt>Notes</dt><dd>{a.notes}</dd></>}
      </dl></div>
      {tr && !tr.assignee && role !== "helper" && (
        <form action={claimTask}><Hidden circle={cid} id={tr.id} ret={`/appointments/${id}`} /><button className="btn primary block">{kidsMode ? "I'll take them" : "I'll drive"}</button></form>
      )}
      {tr && <Link href={`/c/${cid}/tasks/${tr.id}`} className="link">{kidsMode ? "Pick-up task" : "Transport task"}</Link>}
      {role !== "helper" && a.date >= today() && (
        <Link href={`/c/${cid}/appointments/${id}/go`} className="btn block">{kidsMode ? "Open the questions to take with you" : `At the appointment: questions${inner ? " and recording" : ""} in large text`}</Link>
      )}

      <section className="stack" id="pack">
        <h2>{kidsMode ? "Before you go" : "Appointment pack"}</h2>
        {(a.pack_bring || a.pack_parking) ? (
          <div className="card"><dl className="kv">
            <dt>{kidsMode ? "Taking them" : "Who's taking " + (circle.preferred_name || "them")}</dt><dd>{a.needs_transport ? (a.driver ? nameOf(a.driver) : "No one yet") : a.attending || "Not set"}</dd>
            {a.pack_bring && <><dt>What to bring</dt><dd style={{ whiteSpace: "pre-wrap" }}>{a.pack_bring}</dd></>}
            {a.pack_parking && <><dt>Parking and getting there</dt><dd style={{ whiteSpace: "pre-wrap" }}>{a.pack_parking}</dd></>}
          </dl></div>
        ) : <p className="muted small">Nothing added yet. Add what to bring and where to park, so whoever goes has it all.</p>}
        {canEdit(role) && (
          <details className="card pad">
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>{a.pack_bring || a.pack_parking ? "Edit the pack" : "Add to the pack"}</summary>
            <form action={savePack} className="form" style={{ marginTop: 12 }}>
              <Hidden circle={cid} id={id} />
              {a.pack_questions && <label className="fl">Earlier questions<textarea name="pack_questions" rows={3} defaultValue={a.pack_questions} /><span className="note">New questions go in Questions to ask below, where they can be ticked off.</span></label>}
              <label className="fl">What to bring<textarea name="pack_bring" rows={2} defaultValue={a.pack_bring || ""} placeholder="e.g. Appointment letter, medication list, glasses" /></label>
              <label className="fl">Parking and getting there<textarea name="pack_parking" rows={2} defaultValue={a.pack_parking || ""} placeholder="e.g. Car park B, pay at the machine. Drop-off by main entrance." /></label>
              <span className="note">Everyone who can see this {kidsMode ? "event" : "appointment"} can read the pack.</span>
              <button className="btn primary">Save pack</button>
            </form>
          </details>
        )}
      </section>

      {role !== "helper" && <Questions supabase={supabase} circleId={cid} appointmentId={id} nameOf={nameOf} legacy={a.pack_questions} ret={`/appointments/${id}`}
        canAdd me={user.id} canEdit={canEdit(role)} past={a.date < today()} />}

      {inner && (
        <section className="stack" id="recordings">
          <h2>Recordings</h2>
          <Recordings supabase={supabase} circleId={cid} appointmentId={id} nameOf={nameOf} me={user.id} canEdit={canEdit(role)} writeUp={transcribeOn()} />
          <details className="card pad">
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>Record this appointment</summary>
            <p className="small">Whoever goes can record what the doctor or nurse says, including {circle.preferred_name} if nobody else can be there. {transcribeOn() ? "Many Hands writes it up for the family." : "The family can listen to it here."}</p>
            <Recorder circleId={cid} appointmentId={id} name={circle.preferred_name} writeUp={transcribeOn()} sample={isDemoEmail(user.email) ? "/demo/sample-gp-appointment.m4a" : undefined} />
          </details>
        </section>
      )}

      {role !== "helper" && <Thread supabase={supabase} circleId={cid} type="appointment" subjectId={id} nameOf={nameOf} canPost kind="outcome" filter="outcome"
        title={kidsMode ? "Notes afterwards" : "What was said"} empty={kidsMode ? "No notes yet." : "No notes yet. Afterwards, anyone can add what was said, so the family isn't relying on one person's memory."}
        placeholder={kidsMode ? "e.g. Teacher says reading is going well. Next parents' evening in March." : "e.g. Consultant is happy. Blood test in 6 weeks; the surgery will call."} />}
      {role !== "helper" && <Thread supabase={supabase} circleId={cid} type="appointment" subjectId={id} nameOf={nameOf} canPost filter="comment"
        title="Discussion" empty="No messages yet." placeholder="e.g. I can take her if someone collects." />}
      {canEdit(role) && (
        <form action={deleteAppointment}><Hidden circle={cid} id={id} /><button className="link" style={{ color: "var(--coral)" }}>{kidsMode ? "Remove event" : "Remove appointment"}</button></form>
      )}
    </main>
  );
}

async function KidTags({ supabase, cid, ids }: { supabase: Awaited<ReturnType<typeof getCircle>>["supabase"]; cid: string; ids: string[] }) {
  if (!ids.length) return null;
  const { data } = await supabase.from("children").select("id, first_name, colour").eq("circle_id", cid).in("id", ids);
  return <>{(data || []).map((k) => <span key={k.id} className={`kid col-${k.colour}`}>{k.first_name}</span>)}</>;
}
