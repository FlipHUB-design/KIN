import Link from "next/link";
import { getCircle } from "@/lib/data";
import { when } from "@/lib/kin";

const LABEL: Record<string, string> = {
  "circle.create": "created the circle", "invitation.create": "created an invitation", "invitation.accept": "accepted an invitation",
  "member.role": "changed someone's access", "member.pause": "paused someone's access", "member.restore": "restored someone's access",
  "member.remove": "removed someone", "document.upload": "uploaded a document", "document.view": "opened a document",
  "document.delete": "deleted a document", "profile.update": "changed personal details", "emergency.update": "changed emergency information",
};

export default async function Audit({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, role, nameOf } = await getCircle(id);
  if (role !== "admin") return <main className="page"><p>Only administrators can see the access log.</p></main>;
  const { data } = await supabase.from("audit_log").select("*").eq("circle_id", id).order("created_at", { ascending: false }).limit(200);
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Access log</h1>
      <p className="muted">Changes to access, personal details and documents.</p>
      <div className="card list">
        {(data || []).map((a) => (
          <div key={a.id} className="item"><span className="main">
            <span><b>{nameOf(a.actor)}</b> {LABEL[a.action] || a.action}{a.detail?.name ? `: ${a.detail.name}` : ""}{a.detail?.role ? ` (${a.detail.role})` : ""}</span>
            <span className="s">{when(a.created_at)}</span></span></div>
        ))}
        {!data?.length && <p className="empty">Nothing logged yet.</p>}
      </div>
    </main>
  );
}
