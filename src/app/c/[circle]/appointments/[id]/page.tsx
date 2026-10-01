import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, hm, longDate, type Appointment } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { claimTask, deleteAppointment } from "../../actions";

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, circle } = await getCircle(cid);
  const kidsMode = circle.kind === "children";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!data) notFound();
  const a = data as Appointment;
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
      {tr && <Link href={`/c/${cid}/tasks/${tr.id}`} className="link">{kidsMode ? "Pick-up task and comments" : "Transport task and comments"}</Link>}
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
