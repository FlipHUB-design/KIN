import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, hm, longDate, type Appointment } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { claimTask, deleteAppointment } from "../../actions";

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf } = await getCircle(cid);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!data) notFound();
  const a = data as Appointment;
  const { data: tr } = await supabase.from("tasks").select("id, assignee, status").eq("appointment_id", id).maybeSingle();
  return (
    <main className="page">
      <Link href={`/c/${cid}/calendar?d=${a.date}`} className="link">‹ Calendar</Link>
      <Notice sp={sp} />
      <div className="k-appointment"><span className="tag">Appointment</span></div>
      <h1>{a.title}</h1>
      <p className="muted">{longDate(a.date)}{a.time ? ` at ${hm(a.time)}` : ""}</p>
      <div className="card"><dl className="kv">
        <dt>Where</dt><dd>{a.location || "Not set"}</dd>
        <dt>Attending</dt><dd>{a.attending || "Not set"}</dd>
        <dt>Transport</dt><dd>{a.needs_transport ? (a.driver ? `${nameOf(a.driver)} ${nameOf(a.driver) === "You" ? "are" : "is"} driving` : "No driver yet") : "Not needed"}</dd>
        {a.notes && canEdit(role) && <><dt>Notes</dt><dd>{a.notes}</dd></>}
      </dl></div>
      {tr && !tr.assignee && role !== "helper" && (
        <form action={claimTask}><Hidden circle={cid} id={tr.id} ret={`/appointments/${id}`} /><button className="btn primary block">I&apos;ll drive</button></form>
      )}
      {tr && <Link href={`/c/${cid}/tasks/${tr.id}`} className="link">Transport task and comments</Link>}
      {canEdit(role) && (
        <form action={deleteAppointment}><Hidden circle={cid} id={id} /><button className="link" style={{ color: "var(--coral)" }}>Remove appointment</button></form>
      )}
    </main>
  );
}
