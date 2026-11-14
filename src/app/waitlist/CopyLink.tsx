"use client";
import { useState } from "react";

/** The waiting list link with a Copy (or Share, on phones) button. */
export default function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
      <input readOnly value={url} aria-label="Waiting list link" style={{ flex: 1, minWidth: 0 }} onFocus={(e) => e.target.select()} />
      <button type="button" className="btn" onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ title: "Many Hands", text: "Many hands make light work. Join the Many Hands waiting list:", url });
          else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); }
        } catch { /* cancelled */ }
      }}>{done ? "Copied" : "Share"}</button>
    </div>
  );
}
