"use client";
import { useState } from "react";

/** A person in the demo. Shows "Opening…" straight away, because signing in takes a moment. */
export default function PersonLink({ href, initial, name, role, blurb }: { href: string; initial: string; name: string; role: string; blurb: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <a href={href} className="item" aria-busy={busy} onClick={() => setBusy(true)} style={busy ? { background: "var(--sunk)" } : undefined}>
      <span className="avatar">{initial}</span>
      <span className="main"><span className="t">{name} <span className="muted">· {role}</span></span><span className="s">{busy ? `Opening Many Hands as ${name.split(" ")[0]}…` : blurb}</span></span>
      {busy ? <span className="spin" aria-hidden="true" /> : <span className="muted">›</span>}
    </a>
  );
}
