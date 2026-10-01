import Link from "next/link";
import { getCircle } from "@/lib/data";
import { roleLabel, type Role } from "@/lib/kin";
import CopyButton from "@/components/CopyButton";
import { site } from "@/lib/notify";

export default async function Welcome({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, circle, role } = await getCircle(id);
  const kids = circle.kind === "children";
  const [{ count: tasks }, { count: contacts }, { data: invites }, { count: children }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("circle_id", id).neq("status", "cancelled"),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("circle_id", id),
    role === "admin" ? supabase.from("invitations").select("*").eq("circle_id", id).is("accepted_at", null).eq("revoked", false) : Promise.resolve({ data: [] as { id: string; name: string; email: string | null; token: string; role: Role }[] }),
    supabase.from("children").select("id", { count: "exact", head: true }).eq("circle_id", id),
  ]);
  const what = kids ? "organise things for the children" : `coordinate things for ${circle.preferred_name}`;
  return (
    <main className="page">
      <h1>{kids ? "Your family is set up" : `${circle.preferred_name}'s Care Circle is ready`}</h1>
      <div className="card pad">
        <p>{[kids && children ? `${children} ${children === 1 ? "child" : "children"}` : null, `${tasks || 0} jobs and dates`, contacts ? `${contacts} contacts` : null, invites?.length ? `${invites.length} ${invites.length === 1 ? "invitation" : "invitations"}` : null].filter(Boolean).join(" · ")}</p>
        <p className="small muted">Everything can be changed. Jobs nobody has taken yet show as &ldquo;Who can do this?&rdquo; until someone takes them.</p>
      </div>
      {!!invites?.length && <>
        <h2>Send the invitations</h2>
        <p className="muted">Anyone with an email address has been sent theirs. You can also send each link by text or WhatsApp.</p>
        {invites.map((i) => {
          const msg = `Hi ${i.name.split(" ")[0]}, I've set up KIN to help us ${what}. Join here: ${site()}/invite/${i.token}`;
          return (
            <div key={i.id} className="card pad">
              <b>{i.name} <span className="small muted">· {roleLabel(i.role, circle.kind)}{i.email ? ` · emailed to ${i.email}` : ""}</span></b>
              <div className="copybox">{msg}</div>
              <CopyButton text={msg} />
            </div>
          );
        })}
      </>}
      <h2>Next</h2>
      <div className="card list">
        <Link href={`/c/${id}`} className="item"><span className="main"><span className="t">Go to {kids ? "the family" : "the circle"}</span><span className="s">See today and what needs doing</span></span><span className="muted">›</span></Link>
        <Link href={`/c/${id}/tasks`} className="item"><span className="main"><span className="t">Check the jobs</span><span className="s">Change days, times and who does what</span></span><span className="muted">›</span></Link>
        {kids && <Link href={`/c/${id}/schedule/settings`} className="item"><span className="main"><span className="t">Family settings</span><span className="s">Homes, the regular pattern, handover checklist and cost split</span></span><span className="muted">›</span></Link>}
        {kids && <Link href={`/c/${id}/children`} className="item"><span className="main"><span className="t">The children&apos;s details</span><span className="s">School, GP, sizes and allergies</span></span><span className="muted">›</span></Link>}
        {!kids && <Link href={`/c/${id}/more/settings`} className="item"><span className="main"><span className="t">{circle.preferred_name}&apos;s details</span><span className="s">Profile, address, access and check-in routine</span></span><span className="muted">›</span></Link>}
        <Link href="/account/alerts" className="item"><span className="main"><span className="t">Choose your alerts</span><span className="s">Email and text, and quiet hours</span></span><span className="muted">›</span></Link>
      </div>
    </main>
  );
}
