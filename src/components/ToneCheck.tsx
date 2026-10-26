"use client";
import { useState, useTransition } from "react";
import { checkTone, type ToneResult } from "@/app/c/[circle]/tone";

/** A textarea with a "Check my tone" button that suggests a calmer wording. */
export default function ToneCheck({ circleId, name, label, placeholder, rows = 3, defaultValue = "", required, maxLength = 2000, input }: {
  circleId: string; name: string; label?: string; placeholder?: string; rows?: number; defaultValue?: string; required?: boolean; maxLength?: number; input?: boolean;
}) {
  const [text, setText] = useState(defaultValue);
  const [res, setRes] = useState<ToneResult | null>(null);
  const [busy, start] = useTransition();
  const field = input
    ? <input name={name} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder={placeholder} required={required} maxLength={maxLength} />
    : <textarea name={name} rows={rows} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder={placeholder} required={required} maxLength={maxLength} />;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {label ? <label className="fl">{label}{field}</label> : field}
      <div className="row">
        <button type="button" className="btn sm" disabled={busy || text.trim().length < 8} onClick={() => start(async () => setRes(await checkTone(circleId, text)))}>
          {busy ? "Checking…" : "Check my tone"}</button>
        <span className="note">Suggests a calmer wording. Nothing is sent until you choose.</span>
      </div>
      {res && !res.ok && <p className="note" role="status">{res.message}</p>}
      {res && res.ok && (
        <div className={`tonebox ${res.verdict}`} role="status">
          <b>{res.verdict === "fine" ? "This reads calmly." : "A calmer way to say it"}</b>
          <span className="small">{res.why}</span>
          {res.verdict !== "fine" && <>
            <p className="tonetext">{res.suggestion}</p>
            <div className="row">
              <button type="button" className="btn sm primary" onClick={() => { setText(res.suggestion); setRes(null); }}>Use this</button>
              <button type="button" className="btn sm" onClick={() => setRes(null)}>Keep mine</button>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
