"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveRecording } from "@/app/c/[circle]/recordings";

type Stage = "idle" | "recording" | "paused" | "saving" | "writing" | "done" | "error";
const MAX_SECONDS = 60 * 60;
const MAX_BYTES = 24 * 1024 * 1024;
const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/wav": "wav", "audio/aac": "m4a" };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Records the appointment on the phone, then uploads it for the family and Many Hands' write-up. */
export default function Recorder({ circleId, appointmentId, name, writeUp, big, sample }: { circleId: string; appointmentId: string; name: string; writeUp: boolean; big?: boolean; sample?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [consent, setConsent] = useState(false);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const secsRef = useRef(0);

  // Warn before leaving the page mid-recording
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (stage === "recording" || stage === "paused" || stage === "saving") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  const keepAwake = async () => {
    try { lock.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") || null; } catch { /* not supported */ }
  };
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const startTimer = () => {
    stopTimer();
    timer.current = setInterval(() => {
      secsRef.current += 1; setSecs(secsRef.current);
      if (secsRef.current >= MAX_SECONDS) rec.current?.stop();
    }, 1000);
  };

  async function upload(blob: Blob, mime: string, seconds: number) {
    if (blob.size < 2000) { setStage("error"); setMsg("Nothing was recorded. Check the microphone and try again."); return; }
    if (blob.size > MAX_BYTES) { setStage("error"); setMsg("That recording is too large to upload (over 24 MB). Try a shorter recording."); return; }
    setStage("saving"); setMsg("");
    const type = mime.split(";")[0];
    const path = `${circleId}/${crypto.randomUUID()}.${EXT[type] || "webm"}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("recordings").upload(path, blob, { contentType: type, upsert: false });
    if (error) { setStage("error"); setMsg("The recording couldn't be uploaded. Check your signal and try again; it's still on this page until you leave."); retry.current = () => upload(blob, mime, seconds); return; }
    const saved = await saveRecording(circleId, appointmentId, path, type, seconds, true);
    if (!saved.id) { setStage("error"); setMsg(saved.error || "The recording couldn't be saved."); return; }
    if (!writeUp) { setStage("done"); setMsg("Saved. Your family can listen to it."); router.refresh(); return; }
    setStage("writing");
    try {
      const res = await fetch(`/api/recordings/${saved.id}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setStage("done");
      setMsg(j.status === "done" ? `Done. The notes are ready for ${name}'s family.` : j.message || "Saved. Your family can listen to it.");
    } catch {
      setStage("done"); setMsg("Saved. The written notes will follow; your family can listen to it now.");
    }
    router.refresh();
  }
  const retry = useRef<(() => void) | null>(null);

  async function start() {
    setMsg("");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { setStage("error"); setMsg("Many Hands needs permission to use the microphone. Allow it in your browser settings, then try again."); return; }
    const mime = TYPES.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    chunks.current = []; secsRef.current = 0; setSecs(0);
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      stopTimer(); stream.getTracks().forEach((t) => t.stop()); lock.current?.release().catch(() => {});
      upload(new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" }), r.mimeType || mime || "audio/webm", secsRef.current);
    };
    rec.current = r;
    r.start(5000);
    setStage("recording"); startTimer(); keepAwake();
  }

  async function chooseFile(f: File | undefined) {
    if (!f) return;
    if (!consent) { setMsg("Please tick the box to confirm the doctor or nurse agreed to be recorded."); return; }
    const seconds = await new Promise<number>((res) => {
      const a = document.createElement("audio"); a.preload = "metadata";
      a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration) : 0); a.onerror = () => res(0);
      a.src = URL.createObjectURL(f);
    });
    upload(f, f.type || "audio/mp4", seconds);
  }

  const cls = big ? "btn primary block bigbtn" : "btn primary";
  return (
    <div className={`recorder${big ? " large" : ""}`}>
      {stage === "idle" && <>
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I&apos;ve asked the doctor or nurse, and they&apos;re happy for me to record this for my family.</span></label>
        <button type="button" className={cls} disabled={!consent} onClick={start}>● Start recording</button>
        <p className="note">Keep this screen open while you record. Put the phone on the desk between you. It records for up to an hour.</p>
        {sample && <button type="button" className="btn" onClick={async () => {
          const res = await fetch(sample); const blob = await res.blob();
          upload(new File([blob], "sample.m4a", { type: "audio/mp4" }), "audio/mp4", 76);
        }}>Demo: use a sample GP appointment instead</button>}
        <details className="small"><summary>Recorded it another way?</summary>
          <p className="note">Upload a voice memo from your phone instead (up to 24 MB).</p>
          <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm" onChange={(e) => chooseFile(e.target.files?.[0])} />
        </details>
      </>}
      {(stage === "recording" || stage === "paused") && <>
        <div className="recnow" role="status" aria-live="polite"><span className={`recdot${stage === "paused" ? " paused" : ""}`} />{stage === "paused" ? "Paused" : "Recording"} · {clock(secs)}</div>
        <div className="row">
          {stage === "recording"
            ? <button type="button" className="btn" onClick={() => { rec.current?.pause(); stopTimer(); setStage("paused"); }}>Pause</button>
            : <button type="button" className="btn" onClick={() => { rec.current?.resume(); startTimer(); setStage("recording"); }}>Carry on</button>}
          <button type="button" className={big ? "btn primary bigbtn" : "btn primary"} onClick={() => rec.current?.stop()}>■ Stop and save</button>
        </div>
        <p className="note">Don&apos;t lock the phone or switch apps until you press Stop.</p>
      </>}
      {stage === "saving" && <p role="status">Saving the recording…</p>}
      {stage === "writing" && <p role="status">Saved. Many Hands is writing up the notes for {name}&apos;s family. This takes about a minute; you can leave this page.</p>}
      {(stage === "done" || stage === "error") && <p role="status" className={stage === "error" ? "error" : "ok"}>{msg}</p>}
      {stage === "error" && retry.current && <button type="button" className="btn" onClick={() => retry.current?.()}>Try uploading again</button>}
      {stage === "error" && !retry.current && <button type="button" className="btn" onClick={() => { setStage("idle"); setMsg(""); }}>Start again</button>}
      {stage === "idle" && msg && <p className="error">{msg}</p>}
    </div>
  );
}
