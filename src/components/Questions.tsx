import type { SupabaseClient } from "@supabase/supabase-js";
import { Hidden } from "@/components/ui";
import { addQuestion, answerQuestion, removeQuestion } from "@/app/c/[circle]/actions";

type Q = { id: string; body: string; added_by: string | null; asked: boolean; answer: string | null; answered_by: string | null };

/** The family's questions for an appointment: add them before, tick them off and note the answers during. */
export default async function Questions({ supabase, circleId, appointmentId, nameOf, legacy, big, ret, canAdd, me, canEdit, past }: {
  supabase: SupabaseClient; circleId: string; appointmentId: string; nameOf: (id: string | null) => string; legacy?: string | null;
  big?: boolean; ret: string; canAdd: boolean; me: string; canEdit: boolean; past?: boolean;
}) {
  const { data, error } = await supabase.from("appointment_questions").select("id, body, added_by, asked, answer, answered_by").eq("appointment_id", appointmentId).order("created_at");
  if (error) return legacy ? <div className="card pad"><b>Questions to ask</b><p style={{ whiteSpace: "pre-wrap" }}>{legacy}</p></div> : null;
  const qs = (data || []) as Q[];
  const done = qs.filter((q) => q.asked).length;
  return (
    <section className={`stack questions${big ? " large" : ""}`} id="questions">
      <div className="row between"><h2>Questions to ask</h2>{qs.length > 0 && <span className="tag">{done} of {qs.length} asked</span>}</div>
      {legacy && <div className="card pad"><p className="small muted">From the appointment pack</p><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{legacy}</p></div>}
      {!qs.length && !legacy && <p className="muted small">No questions yet. Add anything the family wants asked, so whoever goes, even on their own, has them all in one place.</p>}
      {qs.map((q) => (
        <div key={q.id} className={`card pad qcard${q.asked ? " asked" : ""}`}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <p className="qbody">{q.body}</p>
            <form action={answerQuestion}>
              <Hidden circle={circleId} id={appointmentId} /><input type="hidden" name="question" value={q.id} /><input type="hidden" name="ret" value={ret} />
              <input type="hidden" name="asked" value={q.asked ? "no" : "yes"} />
              <button className={`btn ${q.asked ? "" : "primary"} ${big ? "" : "sm"}`} aria-pressed={q.asked}>{q.asked ? "✓ Asked" : "Mark as asked"}</button>
            </form>
          </div>
          <span className="small muted">From {q.added_by === me ? "you" : nameOf(q.added_by)}</span>
          {q.answer && <p className="qanswer"><b>{q.answered_by ? `${q.answered_by === me ? "Your" : nameOf(q.answered_by) + "'s"} note:` : "From the recording:"}</b> {q.answer}</p>}
          <details>
            <summary className="small" style={{ cursor: "pointer" }}>{q.answer ? "Change the answer" : "What did they say?"}</summary>
            <form action={answerQuestion} className="form" style={{ marginTop: 8 }}>
              <Hidden circle={circleId} id={appointmentId} /><input type="hidden" name="question" value={q.id} /><input type="hidden" name="ret" value={ret} />
              <textarea name="answer" rows={big ? 4 : 3} defaultValue={q.answer || ""} placeholder="A few words is fine" aria-label={`Answer to: ${q.body}`} />
              <button className="btn primary">Save the answer</button>
            </form>
          </details>
          {(q.added_by === me || canEdit) && !big && (
            <form action={removeQuestion}><Hidden circle={circleId} id={appointmentId} /><input type="hidden" name="question" value={q.id} /><input type="hidden" name="ret" value={ret} />
              <button className="link small" style={{ color: "var(--coral)" }}>Remove</button></form>
          )}
        </div>
      ))}
      {canAdd && !past && (
        <form action={addQuestion} className="card pad form">
          <Hidden circle={circleId} id={appointmentId} /><input type="hidden" name="ret" value={ret} />
          <label className="fl">{qs.length ? "Add another question" : "Add a question"}<textarea name="body" rows={2} maxLength={1500} placeholder="e.g. Can the new tablets be taken with her blood pressure ones?" required /></label>
          <span className="note">One per line to add several. Whoever goes to the appointment sees them all.</span>
          <button className="btn">Add</button>
        </form>
      )}
    </section>
  );
}
