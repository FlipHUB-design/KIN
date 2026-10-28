import type { SupabaseClient } from "@supabase/supabase-js";
import { when } from "@/lib/kin";
import { deleteRecording } from "@/app/c/[circle]/recordings";
import type { ConsultSummary } from "@/lib/transcribe";
import RetryWriteUp from "@/components/RetryWriteUp";

type Rec = { id: string; storage_path: string | null; seconds: number | null; status: string; transcript: string | null; summary: ConsultSummary | null; recorded_by: string | null; created_at: string; audio_deleted_at: string | null };
const length = (s: number | null) => (s ? (s >= 60 ? `${Math.round(s / 60)} min` : `${s} sec`) : "");

/** Recordings of an appointment with KIN's write-up, for the inner family only (enforced by the database). */
export default async function Recordings({ supabase, circleId, appointmentId, nameOf, me, canEdit, writeUp }: {
  supabase: SupabaseClient; circleId: string; appointmentId: string; nameOf: (id: string | null) => string; me: string; canEdit: boolean; writeUp?: boolean;
}) {
  const { data, error } = await supabase.from("appointment_recordings").select("id, storage_path, seconds, status, transcript, summary, recorded_by, created_at, audio_deleted_at").eq("appointment_id", appointmentId).order("created_at", { ascending: false });
  if (error || !data?.length) return null;
  const recs = data as Rec[];
  const urls = new Map<string, string>();
  await Promise.all(recs.filter((r) => r.storage_path).map(async (r) => {
    const { data: u } = await supabase.storage.from("recordings").createSignedUrl(r.storage_path!, 3600);
    if (u?.signedUrl) urls.set(r.id, u.signedUrl);
  }));
  return (
    <div className="stack">
      {recs.map((r) => {
        const s = r.summary;
        const mine = r.recorded_by === me;
        return (
          <div key={r.id} className="card pad stack" style={{ gap: 10 }}>
            <div className="row between"><b>Recording{r.seconds ? ` · ${length(r.seconds)}` : ""}</b>
              <span className="small muted">{mine ? "You" : nameOf(r.recorded_by)} · {when(r.created_at)}</span></div>
            {r.status === "transcribing" && <p className="small">KIN is writing this up. Refresh in a minute.</p>}
            {(r.status === "failed" || r.status === "saved") && r.storage_path && writeUp && <>
              {r.status === "failed" && <p className="small">KIN couldn&apos;t write this one up, but you can listen to it below.</p>}
              <RetryWriteUp id={r.id} />
            </>}
            {s && <>
              <p style={{ margin: 0 }}>{s.summary}</p>
              {s.medicines.length > 0 && <div><b className="small">Medicines mentioned</b><ul className="small">{s.medicines.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
              {s.next_steps.length > 0 && <div><b className="small">What happens next</b><ul className="small">{s.next_steps.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
              {s.follow_up && <p className="small"><b>Follow-up:</b> {s.follow_up}</p>}
              <p className="note">Written by KIN from the recording. It may have misheard things, so check anything important with the surgery or hospital.</p>
            </>}
            {urls.get(r.id) && <audio controls preload="none" src={urls.get(r.id)} style={{ width: "100%" }} />}
            {r.audio_deleted_at && <p className="small muted">The audio has been deleted. The written notes are kept.</p>}
            {r.transcript && <details><summary className="small" style={{ cursor: "pointer" }}>Read the full transcript</summary><p className="small" style={{ whiteSpace: "pre-wrap" }}>{r.transcript}</p></details>}
            {(mine || canEdit) && (
              <div className="row">
                {r.storage_path && <form action={deleteRecording}><input type="hidden" name="circle" value={circleId} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="appointment" value={appointmentId} />
                  <button className="btn sm">Delete the audio, keep the notes</button></form>}
                <form action={deleteRecording}><input type="hidden" name="circle" value={circleId} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="appointment" value={appointmentId} /><input type="hidden" name="all" value="yes" />
                  <button className="btn sm warn">Delete everything</button></form>
              </div>
            )}
          </div>
        );
      })}
      <p className="note">Recordings are kept for 30 days, then the audio is deleted automatically. The written notes stay. Only the family can see them, not helpers or contributors.</p>
    </div>
  );
}
