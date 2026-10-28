import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiOn, takeAllowance } from "@/lib/ai";
import { notify } from "@/lib/notify";
import * as T from "@/lib/transcribe";
import { MAX_AUDIO_BYTES, summariseConsult, transcribe, transcribeOn, type ConsultSummary } from "@/lib/transcribe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const say = (status: string, message: string, code = 200) => NextResponse.json({ status, message }, { status: code });

/** Transcribes a saved appointment recording and writes it up for the family. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return say("failed", "Not found", 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return say("failed", "Please sign in again.", 401);
  // Reading through the person's own access proves they're allowed to see it
  const { data: rec } = await supabase.from("appointment_recordings").select("*").eq("id", id).maybeSingle();
  if (!rec) return say("failed", "Not found", 404);
  if (rec.status === "done") return say(rec.status, "Already done");
  if (rec.status === "transcribing" && Date.now() - Date.parse(rec.created_at) < 5 * 60000) return say(rec.status, "Already being written up");

  const admin = createAdminClient();
  if (!admin) return say("saved", "Saved. Transcription isn't set up on this server.");
  const [{ data: appt }, { data: circle }, { data: members }] = await Promise.all([
    admin.from("appointments").select("id, title").eq("id", rec.appointment_id).single(),
    admin.from("care_circles").select("preferred_name, person_name, kind").eq("id", rec.circle_id).single(),
    admin.from("memberships").select("user_id, role, profiles(display_name)").eq("circle_id", rec.circle_id).eq("status", "active"),
  ]);
  const family = (members || []).filter((m) => ["admin", "family", "supported"].includes(m.role)).map((m) => m.user_id as string);
  const who = ((members || []).find((m) => m.user_id === rec.recorded_by)?.profiles as unknown as { display_name: string } | null)?.display_name?.split(" ")[0] || "Someone";
  const name = circle?.preferred_name || "them";
  const circleName = `${name}'s Care Circle`;
  const path = `/appointments/${rec.appointment_id}#recordings`;

  if (!transcribeOn()) {
    await notify({ circleId: rec.circle_id, circleName, actor: user.id, to: family, level: "update", title: `${who} recorded ${appt?.title || "an appointment"}`, body: "You can listen to it in Many Hands.", path });
    return say("saved", "Saved. Your family can listen to it.");
  }
  if (!(await takeAllowance(user.id, "transcribe"))) return say("saved", "Saved. You've reached today's limit for writing up recordings, so it'll need to be done tomorrow.");

  await admin.from("appointment_recordings").update({ status: "transcribing" }).eq("id", id);
  const fail = async (msg: string) => { await admin.from("appointment_recordings").update({ status: "failed" }).eq("id", id); return say("failed", msg); };
  const { data: file, error } = await admin.storage.from("recordings").download(rec.storage_path);
  if (error || !file) return fail("The recording couldn't be opened. Your family can still try again later.");
  if (file.size > MAX_AUDIO_BYTES) return fail("The recording is too long to write up automatically. Your family can still listen to it.");
  const text = await transcribe(file, rec.mime || file.type || "audio/webm");
  if (!text) return fail(`Many Hands couldn't turn the recording into text${T.lastTranscribeError ? ` because ${T.lastTranscribeError}` : ""}. Your family can still listen to it.`);

  const { data: qs } = await admin.from("appointment_questions").select("id, body, answer").eq("appointment_id", rec.appointment_id).order("created_at");
  const summary: ConsultSummary | null = aiOn() ? await summariseConsult(text, name, appt?.title || "Appointment", (qs || []).map((q) => ({ id: q.id, body: q.body }))) : null;
  await admin.from("appointment_recordings").update({ status: "done", transcript: text.slice(0, 200000), summary }).eq("id", id);

  if (summary) {
    // Fill in answers nobody has written yet; the family can still change them
    for (const a of summary.answers) {
      const q = (qs || []).find((x) => x.id === a.question_id);
      if (q && !q.answer && !/^not covered/i.test(a.answer)) await admin.from("appointment_questions").update({ asked: true, answer: a.answer, answered_by: null, answered_at: new Date().toISOString() }).eq("id", q.id);
    }
    const body = [summary.summary,
      summary.medicines.length ? `Medicines: ${summary.medicines.join("; ")}` : "",
      summary.next_steps.length ? `Next: ${summary.next_steps.join("; ")}` : "",
      summary.follow_up ? `Follow-up: ${summary.follow_up}` : ""].filter(Boolean).join("\n\n");
    await admin.from("discussions").insert({ circle_id: rec.circle_id, subject_type: "appointment", subject_id: rec.appointment_id, kind: "outcome", author: rec.recorded_by, body: `From the recording:\n${body}`.slice(0, 2000) });
  }
  await admin.from("activity").insert({ circle_id: rec.circle_id, actor: rec.recorded_by, verb: "shared notes from a recording of", subject: appt?.title || null });
  await notify({ circleId: rec.circle_id, circleName, actor: user.id, to: family, level: "update",
    title: `Notes from ${name}'s ${appt?.title || "appointment"} are ready`, body: summary?.summary.slice(0, 280) || "The transcript is ready to read.", path });
  return say("done", "Done");
}
