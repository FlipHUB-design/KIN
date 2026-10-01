import Link from "next/link";
import { getCircle } from "@/lib/data";
import { isInner, when, type Activity } from "@/lib/kin";

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, members, nameOf, role, circle } = await getCircle(id);
  let q = supabase.from("activity").select("*").eq("circle_id", id).order("created_at", { ascending: false }).limit(100);
  if (sp.who) q = q.eq("actor", sp.who);
  const { data } = await q;
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Activity</h1>
      {isInner(role, circle.kind) && (
        <nav className="chips" aria-label="Filter by person">
          <Link href={`/c/${id}/more/activity`} className="chip" aria-current={!sp.who}>Everyone</Link>
          {members.map((m) => <Link key={m.user_id} href={`/c/${id}/more/activity?who=${m.user_id}`} className="chip" aria-current={sp.who === m.user_id}>{nameOf(m.user_id)}</Link>)}
        </nav>
      )}
      <div className="card list">
        {((data || []) as Activity[]).map((a) => (
          <div key={a.id} className="item"><span className="avatar sm">{nameOf(a.actor)[0]}</span>
            <span className="main"><span><b>{nameOf(a.actor)}</b> {a.verb}{a.subject ? ` ${a.subject}` : ""}</span><span className="s">{when(a.created_at)}</span></span></div>
        ))}
        {!data?.length && <p className="empty">Nothing yet.</p>}
      </div>
      {!isInner(role, circle.kind) && <p className="note">You can see your own activity. The full timeline is for the family.</p>}
    </main>
  );
}
