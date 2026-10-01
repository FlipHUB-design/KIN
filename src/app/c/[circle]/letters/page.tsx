import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, when } from "@/lib/kin";
import { letterReadingOn, type LetterResult } from "@/lib/letters";
import { Hidden, Notice } from "@/components/ui";
import LetterUpload from "@/components/LetterUpload";
import { scanLetter, scanSampleLetter } from "../actions";

export const maxDuration = 60;

export default async function Letters({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, circle } = await getCircle(id);
  const kidsMode = circle.kind === "children";
  if (!canEdit(role)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Letters are shared with family members only.</p></main>;
  const { data } = await supabase.from("letter_scans").select("*").eq("circle_id", id).order("created_at", { ascending: false }).limit(30);
  const on = letterReadingOn();
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Letters</h1>
      <p className="muted">{kidsMode ? "Take a photo of a school letter, party invitation, club newsletter or appointment letter." : "Take a photo of a letter from the council, DWP, NHS, a bank or an insurer."} KIN reads it, pulls out any deadlines and suggests tasks. Nothing is added until you say so.</p>
      <Notice sp={sp} />
      {on ? <LetterUpload circle={id} scan={scanLetter} /> : (
        <div className="card pad">
          <b>Automatic letter reading isn&apos;t switched on yet</b>
          <p className="small muted">The site owner needs to add an Anthropic API key. You can still try it with a sample letter, and uploaded letters are saved to Documents.</p>
          <LetterUpload circle={id} scan={scanLetter} />
        </div>
      )}
      <form action={scanSampleLetter}><Hidden circle={id} /><button className="btn block">{kidsMode ? "Try it with a sample school trip letter" : "Try it with a sample council letter"}</button></form>
      <section className="stack">
        <h2>Read so far</h2>
        <div className="card list">
          {(data || []).map((l) => {
            const r = l.result as LetterResult;
            const open = r.suggestions.filter((s) => !s.task_id && !s.dismissed).length;
            return (
              <Link key={l.id} href={`/c/${id}/letters/${l.id}`} className="item">
                <span className="main"><span className="t">{r.organisation}</span><span className="s">{r.document_type} · read by {nameOf(l.created_by)} {when(l.created_at).toLowerCase()}</span></span>
                {open > 0 && <span className="tag unas">{open} to review</span>}
              </Link>
            );
          })}
          {!data?.length && <p className="empty">No letters yet.</p>}
        </div>
      </section>
      <p className="note">Letters are sent securely to our AI provider, Anthropic, to be read. KIN never gives medical, legal or financial advice.</p>
    </main>
  );
}
