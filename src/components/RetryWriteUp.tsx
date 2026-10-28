"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Asks Many Hands to try writing up a recording again. */
export default function RetryWriteUp({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="row">
      <button type="button" className="btn sm" disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        const j = await fetch(`/api/recordings/${id}`, { method: "POST" }).then((r) => r.json()).catch(() => ({ message: "Couldn't reach Many Hands." }));
        setBusy(false); setMsg(j.status === "done" ? "" : j.message || ""); router.refresh();
      }}>{busy ? "Writing it up…" : "Try the write-up again"}</button>
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}
