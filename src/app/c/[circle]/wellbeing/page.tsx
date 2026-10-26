import Link from "next/link";
import { getCircle } from "@/lib/data";
import { isInner, when } from "@/lib/kin";
import { Header } from "@/components/ui";
import { moodLabel } from "@/lib/support";
import { trend, type Entry } from "@/lib/wellbeing";

export default async function Wellbeing({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, circle, role, me } = await getCircle(id);
  if (!isInner(role, circle.kind) || role === "supported") return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>This is for the family.</p></main>;
  const { data } = await supabase.from("wellbeing_entries").select("mood, note, created_at, user_id").eq("circle_id", id).order("created_at", { ascending: false }).limit(400);
  const entries = (data || []) as Entry[];
  const tr = trend(entries);
  const notes = entries.filter((e) => e.note).slice(0, 8);
  return (
    <main className="page">
      <Header title="How they've been" sub={`${circle.preferred_name}'s answers to “How are you today?”`} initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/more`, label: "More" }} />
      {tr.rising ? (
        <section className="status attn"><div className="sline"><span className="dot" />More “Not great” days lately</div>
          <p>{tr.recent} in the last two weeks, compared with {tr.before} the two weeks before. It may be worth a call or a visit.</p></section>
      ) : (
        <section className="status good"><div className="sline"><span className="dot" />{tr.answered ? `${tr.answered} answers in the last two weeks` : "No answers yet"}</div>
          <p>{tr.recent ? `${tr.recent} “Not great” ${tr.recent === 1 ? "day" : "days"} in the last two weeks.` : "No “Not great” days in the last two weeks."}</p></section>
      )}
      <section className="stack">
        <h2>Last {Math.ceil(tr.cells.length / 7)} weeks</h2>
        <div className="moodgrid" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="small muted" style={{ textAlign: "center" }}>{d}</span>)}</div>
        <div className="moodgrid" role="list" aria-label="One square per day">
          {tr.cells.map((c) => (
            <span key={c.date} role="listitem" className={`mcell ${c.mood || ""}`} style={c.future ? { opacity: 0.3 } : undefined}
              aria-label={`${c.date}: ${c.mood ? moodLabel(c.mood) : "no answer"}`}>{c.mood ? moodLabel(c.mood).replace("Not great", "Low") : ""}</span>
          ))}
        </div>
        <div className="row small"><span className="mcell good" style={{ minHeight: 24, padding: "0 8px" }}>Good</span><span className="mcell ok" style={{ minHeight: 24, padding: "0 8px" }}>OK</span><span className="mcell not_great" style={{ minHeight: 24, padding: "0 8px" }}>Low = Not great</span><span className="muted">Blank = no answer</span></div>
      </section>
      {!!notes.length && (
        <section className="stack"><h2>Things they wanted you to know</h2>
          <div className="card list">{notes.map((e) => (
            <div key={e.created_at} className="item"><span className="main"><span className="t">&ldquo;{e.note}&rdquo;</span><span className="s">{moodLabel(e.mood)} · {when(e.created_at)}</span></span></div>
          ))}</div>
        </section>
      )}
      <p className="note">This is what {circle.preferred_name} chose to share, to help the family keep in touch. It isn&apos;t a health assessment. If you&apos;re worried, talk to them, their GP or NHS 111. In an emergency, call 999.</p>
    </main>
  );
}
