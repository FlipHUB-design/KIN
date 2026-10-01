import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, when } from "@/lib/kin";
import { buildRecords, RECORD_TYPES } from "@/lib/records";
import { Header } from "@/components/ui";

export default async function Records({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, me } = await getCircle(id);
  const base = `/c/${id}`;
  if (!canEdit(role)) return <main className="page"><Link href={base} className="link">‹ Home</Link><p>Records are for parents.</p></main>;
  const all = await buildRecords(supabase, id, nameOf);
  const type = RECORD_TYPES.find((t) => t === sp.type);
  const list = type ? all.filter((r) => r.type === type) : all;
  return (
    <main className="page">
      <Header title="Records" sub="A dated history of requests, answers, costs and handovers" initial={(me.profiles?.display_name || "?")[0]} back={{ href: `${base}/more`, label: "More" }} />
      <nav className="chips" aria-label="Filter">
        <Link href={`${base}/records`} className="chip" aria-current={!type}>All</Link>
        {RECORD_TYPES.map((t) => <Link key={t} href={`${base}/records?type=${t}`} className="chip" aria-current={type === t}>{t}</Link>)}
      </nav>
      <a href={`${base}/records/export${type ? `?type=${type}` : ""}`} className="btn">Download as a spreadsheet (CSV)</a>
      <div className="card list">
        {list.map((r, i) => (
          <div key={i} className="item" style={{ alignItems: "flex-start" }}>
            <span className="tag" style={{ minWidth: 86, textAlign: "center" }}>{r.type}</span>
            <span className="main"><span><b>{r.who}</b> {r.text}</span><span className="s">{when(r.at)}</span></span>
          </div>
        ))}
        {!list.length && <p className="empty">Nothing recorded yet.</p>}
      </div>
      <p className="note">Each entry shows when it was made and by whom. Requests and answers can&apos;t be edited afterwards. This is a factual record, not legal advice. If you&apos;re using it in mediation or court, check with your mediator or solicitor what they need.</p>
    </main>
  );
}
