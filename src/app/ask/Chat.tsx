"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { askKin, type Reply, type Turn } from "./actions";

type Msg = Turn & { links?: Reply["links"] };

export default function Chat({ circleId, suggestions, aiReady }: { circleId: string | null; suggestions: string[]; aiReady: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const send = (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next); setText("");
    start(async () => {
      try {
        const r = await askKin(next.map(({ role, text }) => ({ role, text })), circleId);
        setMsgs((m) => [...m, { role: "assistant", text: r.text, links: r.links }]);
      } catch {
        setMsgs((m) => [...m, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
      }
    });
  };

  return (
    <div className="stack">
      <div className="chat" aria-live="polite">
        <div className="bubble kin">Hi, I can help with how to do things in KIN. What would you like to know?</div>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "me" : "kin"}`}>
            {m.text}
            {!!m.links?.length && <div className="row">{m.links.map((l) => <Link key={l.href} href={l.href} className="btn sm">{l.label} ›</Link>)}</div>}
          </div>
        ))}
        {busy && <div className="bubble kin muted">Thinking…</div>}
        <div ref={end} />
      </div>
      {!msgs.length && <div className="row">{suggestions.map((s) => <button key={s} type="button" className="btn sm" onClick={() => send(s)}>{s}</button>)}</div>}
      <form className="chatform" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label className="sr-only" htmlFor="ask">Your question</label>
        <input id="ask" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. How do I invite Grandma?" maxLength={500} autoComplete="off" />
        <button className="btn primary" disabled={busy || !text.trim()}>Ask</button>
      </form>
      <p className="note">{aiReady ? "Answers come from KIN's AI helper and can be wrong. It only knows how KIN works, not your family's details." : "Answers come from KIN's help guide."} In an emergency, call 999.</p>
    </div>
  );
}
