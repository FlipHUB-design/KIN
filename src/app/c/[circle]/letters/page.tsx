import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, when } from "@/lib/kin";
import { letterReadingOn, type LetterResult } from "@/lib/letters";
import { Hidden, Notice } from "@/components/ui";
import LetterUpload from "@/components/LetterUpload";
import { createInbound, readPastedEmail, scanLetter, scanSampleLetter } from "../actions";
import CopyButton from "@/components/CopyButton";
import { inboundDomain } from "@/lib/inbound";

export const maxDuration = 60;

export default async function Letters({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, circle } = await getCircle(id);
  const kidsMode = circle.kind === "children";
  if (!canEdit(role)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Letters are shared with family members only.</p></main>;
  const { data } = await supabase.from("letter_scans").select("*").eq("circle_id", id).order("created_at", { ascending: false }).limit(30);
  const on = letterReadingOn();
  const { data: inbound } = await supabase.from("inbound_addresses").select("token").eq("circle_id", id).maybeSingle();
  const domain = inboundDomain();
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Letters</h1>
      <p className="muted">{kidsMode ? "Take a photo of a school letter, party invitation, club newsletter or appointment letter." : "Take a photo of a letter from the council, DWP, NHS, a bank or an insurer."} Many Hands reads it, pulls out any deadlines and suggests tasks. Nothing is added until you say so.</p>
      <Notice sp={sp} />
      {on ? <LetterUpload circle={id} scan={scanLetter} /> : (
        <div className="card pad">
          <b>Automatic letter reading isn&apos;t switched on yet</b>
          <p className="small muted">The site owner needs to add an Anthropic API key. You can still try it with a sample letter, and uploaded letters are saved to Documents.</p>
          <LetterUpload circle={id} scan={scanLetter} />
        </div>
      )}
      <details className="card pad">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Paste an email instead</summary>
        <form action={readPastedEmail} className="form" style={{ marginTop: 12 }}>
          <Hidden circle={id} />
          <label className="fl">The email<textarea name="text" rows={8} required maxLength={20000} placeholder={kidsMode ? "Copy the whole email from school, including the dates, and paste it here." : "Copy the whole email, including the dates, and paste it here."} /></label>
          <button className="btn primary" disabled={!on}>Read this email</button>
          {!on && <span className="note">Needs automatic reading to be switched on.</span>}
        </form>
      </details>
      <section className="card pad stack" id="forward">
        <b>{kidsMode ? "Forward school emails to Many Hands" : "Forward emails to Many Hands"}</b>
        {!domain ? <p className="small muted">Email forwarding isn&apos;t set up on this Many Hands site yet. Until it is, paste emails above.</p>
          : inbound ? <>
            <p className="small">Forward {kidsMode ? "emails from school, clubs and parties" : "letters and emails"} to this private address. Many Hands reads each one and adds it here for you to review.</p>
            <div className="copybox">{`kin-${inbound.token}@${domain}`}</div>
            <div className="row"><CopyButton text={`kin-${inbound.token}@${domain}`} />
              <form action={createInbound}><Hidden circle={id} /><input type="hidden" name="reset" value="yes" /><button className="btn sm">Make a new address</button></form></div>
            <span className="note">Tip: set up a rule in your email to forward messages from the school automatically. Only forward emails about your family; don&apos;t share the address.</span>
          </> : <form action={createInbound}><Hidden circle={id} /><button className="btn">Get a forwarding address</button></form>}
      </section>
      <form action={scanSampleLetter}><Hidden circle={id} /><button className="btn block">{kidsMode ? "Try it with a sample school trip letter" : "Try it with a sample council letter"}</button></form>
      <section className="stack">
        <h2>Read so far</h2>
        <div className="card list">
          {(data || []).map((l) => {
            const r = l.result as LetterResult;
            const open = r.suggestions.filter((s) => !s.task_id && !s.dismissed).length;
            return (
              <Link key={l.id} href={`/c/${id}/letters/${l.id}`} className="item">
                <span className="main"><span className="t">{r.organisation}</span><span className="s">{r.document_type} · {l.source === "email" && !l.created_by ? "forwarded by email" : `read by ${nameOf(l.created_by)}`} {when(l.created_at).toLowerCase()}</span></span>
                {open > 0 && <span className="tag unas">{open} to review</span>}
              </Link>
            );
          })}
          {!data?.length && <p className="empty">No letters yet.</p>}
        </div>
      </section>
      <p className="note">Letters are sent securely to our AI provider, Anthropic, to be read. Many Hands never gives medical, legal or financial advice.</p>
    </main>
  );
}
