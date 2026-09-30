import Link from "next/link";
import { getCircle } from "@/lib/data";
import { ROLE_DESC, ROLE_LABEL, type Role } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import CopyButton from "@/components/CopyButton";
import { invite } from "../../actions";

export default async function Invite({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role } = await getCircle(id);
  if (role !== "admin") return <main className="page"><p>Only administrators can invite people.</p></main>;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (sp.sent) {
    const { data: inv } = await supabase.from("invitations").select("*").eq("id", sp.sent).eq("circle_id", id).maybeSingle();
    if (inv) {
      const url = `${site}/invite/${inv.token}`;
      const msg = `Hi ${inv.name.split(" ")[0]}, I've set up KIN to help us coordinate things for ${circle.preferred_name}. Join here: ${url}`;
      return (
        <main className="page">
          <Link href={`/c/${id}/people`} className="link">‹ Care Circle</Link>
          <h1>Send {inv.name.split(" ")[0]} this link</h1>
          <p className="muted">Share it by text, WhatsApp or email. It works once and expires in 14 days.</p>
          <div className="card pad">
            <div className="copybox">{msg}</div>
            <CopyButton text={msg} />
          </div>
          <p className="note">{ROLE_LABEL[inv.role as Role]}: {ROLE_DESC[inv.role as Role]}</p>
          <Link href={`/c/${id}/people/invite`} className="btn">Invite someone else</Link>
        </main>
      );
    }
  }
  return (
    <main className="page">
      <Link href={`/c/${id}/people`} className="link">‹ Care Circle</Link>
      <h1>Invite to {circle.preferred_name}&apos;s circle</h1>
      <Notice sp={sp} />
      <form action={invite} className="form">
        <Hidden circle={id} />
        <label className="fl">Name<input name="name" required maxLength={80} /></label>
        <label className="fl">Email (optional)<input name="email" type="email" /></label>
        <div className="two">
          <label className="fl">Relationship<input name="relationship" placeholder="e.g. Son, Neighbour, Cleaner" required /></label>
          <label className="fl">Access<select name="role" defaultValue="family">
            {(["family", "contributor", "helper", "supported", "admin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select></label>
        </div>
        <div className="card pad small">{(["family", "contributor", "helper", "supported", "admin"] as Role[]).map((r) => <p key={r}><b>{ROLE_LABEL[r]}:</b> {ROLE_DESC[r]}</p>)}</div>
        <button className="btn primary block">Create invitation link</button>
      </form>
    </main>
  );
}
