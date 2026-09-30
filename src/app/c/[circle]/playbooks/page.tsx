import Link from "next/link";
import { getCircle } from "@/lib/data";
import { PLAYBOOKS } from "@/lib/playbooks";

export default async function Playbooks({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase } = await getCircle(id);
  const { data } = await supabase.from("tasks").select("source, status").eq("circle_id", id).like("source", "playbook:%");
  const started = (slug: string) => (data || []).filter((t) => t.source === `playbook:${slug}`);
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Playbooks</h1>
      <p className="muted">Step-by-step plans for the UK paperwork and moments families get stuck on. Start one and KIN adds the steps as tasks, with links to the official guidance.</p>
      <div className="card list">
        {PLAYBOOKS.map((p) => {
          const t = started(p.slug);
          const done = t.filter((x) => x.status === "done").length;
          return (
            <Link key={p.slug} href={`/c/${id}/playbooks/${p.slug}`} className="item">
              <span className="main"><span className="t">{p.title}</span><span className="s">{p.summary}</span></span>
              {t.length > 0 ? <span className="tag done">{done}/{t.length} done</span> : <span className="muted">›</span>}
            </Link>
          );
        })}
      </div>
      <p className="note">Rules and deadlines change. Each step links to GOV.UK or NHS.uk, which have the current details.</p>
    </main>
  );
}
