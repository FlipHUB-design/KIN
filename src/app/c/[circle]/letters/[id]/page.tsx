import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, dayLabel, longDate, when, type Child } from "@/lib/kin";
import { ChildPicker } from "../../tasks/TaskForm";
import type { LetterResult } from "@/lib/letters";
import { Hidden, Notice } from "@/components/ui";
import { createFromLetter, dismissSuggestion } from "../../actions";

export default async function LetterPage({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, role, members, user, nameOf, circle } = await getCircle(cid);
  const kidsMode = circle.kind === "children";
  const { data: kidRows } = kidsMode ? await supabase.from("children").select("*").eq("circle_id", cid).order("sort") : { data: [] };
  const kids = (kidRows || []) as Child[];
  if (!canEdit(role) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: scan } = await supabase.from("letter_scans").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!scan) notFound();
  const r = scan.result as LetterResult;
  const who = members.filter((m) => m.role !== "supported" && m.status === "active");
  return (
    <main className="page">
      <Link href={`/c/${cid}/letters`} className="link">‹ Letters</Link>
      <Notice sp={sp} />
      <span className="label">{r.document_type}</span>
      <h1>{r.organisation}</h1>
      <p className="muted">{r.letter_date ? `Dated ${longDate(r.letter_date)} · ` : ""}Read by {nameOf(scan.created_by)} {when(scan.created_at).toLowerCase()}</p>
      {scan.source === "sample" && <p className="note">This is a sample result. Real letters are read automatically once letter reading is switched on.</p>}
      <div className="card pad"><span className="label">What it says</span><p>{r.summary}</p>
        {scan.document_id && <a className="link" href={`/c/${cid}/more/documents/${scan.document_id}`} target="_blank" rel="noopener">Open the letter</a>}
      </div>
      <section className="stack">
        <h2>{r.suggestions.length ? "KIN suggests" : "No actions found"}</h2>
        {!r.suggestions.length && <p className="muted">KIN didn&apos;t find anything this letter asks you to do. It&apos;s saved in Documents.</p>}
        {r.suggestions.map((sg, i) => (
          <div key={i} className="card pad">
            {sg.task_id ? (
              <><div className="row between"><b>{sg.title}</b><span className="tag done">Added</span></div>
                <Link href={`/c/${cid}/tasks/${sg.task_id}`} className="link">Open task</Link></>
            ) : sg.dismissed ? (
              <div className="row between"><span className="muted">{sg.title}</span><span className="tag">Ignored</span></div>
            ) : (
              <>
                <p className="small muted">{sg.why}{sg.due_date ? ` · ${dayLabel(sg.due_date)}` : ""}</p>
                <form action={createFromLetter} className="form">
                  <Hidden circle={cid} id={id} /><input type="hidden" name="i" value={i} />
                  <label className="fl">Task<input name="title" defaultValue={sg.title} required /></label>
                  <p className="small">{sg.detail}</p>
                  {kidsMode && <ChildPicker kids={kids} selected={kids.filter((k) => `${sg.title} ${sg.detail} ${r.summary}`.includes(k.first_name)).map((k) => k.id)} label="For which children?" />}
                  <div className="two">
                    <label className="fl">Due<input type="date" name="due_date" defaultValue={sg.due_date || ""} /></label>
                    <label className="fl">Who?<select name="assignee" defaultValue="">
                      <option value="">Anyone (ask the family)</option>
                      {who.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}{m.user_id === user.id ? " (you)" : ""}</option>)}
                    </select></label>
                  </div>
                  <label className="checkline"><input type="checkbox" name="private" defaultChecked={!kidsMode} /> {kidsMode ? "Parents only" : "Family only"}</label>
                  <div className="row"><button className="btn primary">Create task</button></div>
                </form>
                <form action={dismissSuggestion}><Hidden circle={cid} id={id} /><input type="hidden" name="i" value={i} /><button className="link">Ignore</button></form>
              </>
            )}
          </div>
        ))}
      </section>
      <p className="note">Check the details against the letter. KIN can misread things, and it never gives legal, financial or medical advice.</p>
    </main>
  );
}
