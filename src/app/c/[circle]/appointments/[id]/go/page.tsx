import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, hm, isInner, longDate, today, type Appointment } from "@/lib/kin";
import { Notice } from "@/components/ui";
import Questions from "@/components/Questions";
import Recorder from "@/components/Recorder";
import Thread from "@/components/Thread";
import { transcribeOn } from "@/lib/transcribe";
import { isDemoEmail } from "@/lib/notify";
import { aiOn } from "@/lib/ai";

/** "At the appointment": a simple, large view for whoever goes, including the person on their own. */
export default async function AtTheAppointment({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, circle, user } = await getCircle(cid);
  if (!/^[0-9a-f-]{36}$/i.test(id) || role === "helper") notFound();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!data) notFound();
  const a = data as Appointment;
  const self = role === "supported";
  const inner = isInner(role, circle.kind) && circle.kind !== "children";
  const taking = a.driver ? (a.driver === user.id ? "You're driving" : `${nameOf(a.driver)} is ${self ? "taking you" : "driving"}`) : null;
  const ret = `/appointments/${id}/go`;
  return (
    <main className="page sp go">
      <Link href={self ? `/c/${cid}` : `/c/${cid}/appointments/${id}`} className="link">‹ {self ? "Back" : "Appointment details"}</Link>
      <Notice sp={sp} />
      <div>
        <p className="label">At the appointment</p>
        <h1>{a.title}</h1>
        <p>{longDate(a.date)}{a.time ? ` at ${hm(a.time)}` : ""}</p>
        {a.location && <p className="muted">{a.location}</p>}
        {taking && <p><b>{taking}</b></p>}
      </div>

      {(a.pack_bring || a.pack_parking) && (
        <div className="card pad stack" style={{ gap: 8 }}>
          {a.pack_bring && <div><b>Bring</b><p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{a.pack_bring}</p></div>}
          {a.pack_parking && <div><b>Getting there</b><p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{a.pack_parking}</p></div>}
        </div>
      )}

      <Questions supabase={supabase} circleId={cid} appointmentId={id} nameOf={nameOf} legacy={a.pack_questions} big ret={ret}
        canAdd me={user.id} canEdit={canEdit(role)} past={a.date < today()} />

      {inner && (
        <section className="stack" id="record">
          <h2>Record the appointment</h2>
          <p>{self ? "Your family can't be there, so you can record what the doctor says. " : ""}Many Hands saves the recording for {self ? "your" : `${circle.preferred_name}'s`} family{transcribeOn() ? `, writes out what was said${aiOn() ? ", and answers the questions above from it" : ""}` : ""}.</p>
          <Recorder circleId={cid} appointmentId={id} name={circle.preferred_name} writeUp={transcribeOn()} big sample={isDemoEmail(user.email) ? "/demo/sample-gp-appointment.m4a" : undefined} />
          <p className="note">In the UK you can record your own appointment. It&apos;s polite to ask first, and most doctors and nurses are happy to help.</p>
        </section>
      )}

      <Thread supabase={supabase} circleId={cid} type="appointment" subjectId={id} nameOf={nameOf} canPost kind="outcome" filter="outcome"
        title="Anything else to remember?" empty="Write down anything the doctor or nurse said, in your own words. Your family will see it."
        placeholder="e.g. Blood test in 6 weeks. Keep taking the new tablets." />

      {self && <div className="big"><Link href={`/c/${cid}/help`}>Call family</Link><Link href={`/c/${cid}`}>Done</Link></div>}
      {!self && <Link href={`/c/${cid}/appointments/${id}#recordings`} className="btn block">Done</Link>}
    </main>
  );
}
