import { when } from "@/lib/kin";
import ToneCheck from "@/components/ToneCheck";
import { addDiscussion } from "@/app/c/[circle]/actions";
import type { SupabaseClient } from "@supabase/supabase-js";

type Msg = { id: string; author: string | null; body: string; kind: string; created_at: string };

/** A short discussion attached to one appointment, request, agreement or cost. */
export default async function Thread({ supabase, circleId, type, subjectId, nameOf, canPost, kind = "comment", title, empty, placeholder, filter }: {
  supabase: SupabaseClient; circleId: string; type: "appointment" | "change" | "agreement" | "expense"; subjectId: string;
  nameOf: (id: string | null) => string; canPost: boolean; kind?: "comment" | "outcome"; title: string; empty: string; placeholder: string; filter?: "comment" | "outcome";
}) {
  let q = supabase.from("discussions").select("id, author, body, kind, created_at").eq("subject_type", type).eq("subject_id", subjectId).order("created_at");
  if (filter) q = q.eq("kind", filter);
  const { data, error } = await q;
  if (error) return null; // not set up yet
  const msgs = (data || []) as Msg[];
  return (
    <section className="stack" id={kind === "outcome" ? "notes" : "thread"}>
      <h2>{title}</h2>
      <div className="thread">
        {!msgs.length && <p className="muted small">{empty}</p>}
        {msgs.map((m) => (
          <div key={m.id} className="msg">
            <span className="avatar" aria-hidden="true">{nameOf(m.author)[0]}</span>
            <div className={`bub${m.kind === "outcome" ? " outcome" : ""}`}>
              <span className="small"><b>{nameOf(m.author)}</b> · {when(m.created_at)}{m.kind === "outcome" ? " · Notes from the appointment" : ""}</span>
              <p>{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      {canPost && (
        <form action={addDiscussion} className="form">
          <input type="hidden" name="circle" value={circleId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="subject" value={subjectId} />
          <input type="hidden" name="kind" value={kind} />
          <ToneCheck circleId={circleId} name="body" placeholder={placeholder} rows={kind === "outcome" ? 4 : 2} required />
          <button className="btn primary">{kind === "outcome" ? "Save notes" : "Post"}</button>
        </form>
      )}
    </section>
  );
}
