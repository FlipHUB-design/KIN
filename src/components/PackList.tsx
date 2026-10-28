"use client";
import { useEffect, useState } from "react";

/** A packing list children can tick off. Ticks are kept on this device until the handover day. */
export default function PackList({ items, storeKey }: { items: string[]; storeKey: string }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(storeKey) || "[]")); } catch { /* private mode */ } }, [storeKey]);
  const toggle = (i: string) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const left = items.filter((i) => !done.includes(i)).length;
  return (
    <div className="packlist">
      {items.map((i) => (
        <label key={i} className={done.includes(i) ? "packed" : ""}>
          <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} /><span>{i}</span>
        </label>
      ))}
      <p className="small muted" role="status">{left ? `${left} still to pack` : "All packed!"}</p>
    </div>
  );
}
