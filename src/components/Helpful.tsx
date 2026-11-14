import Link from "next/link";
import { affiliateOn, helpfulList } from "@/lib/helpful";

export const Disclosure = () => (
  <p className="note" style={{ margin: 0 }}>
    Suggestions only: we don&apos;t sell anything ourselves. Links open Amazon{affiliateOn() ? ", and if you buy, Many Hands may earn a small commission at no extra cost to you" : ""}.
  </p>
);

/** A short "Helpful things" card for one list, shown where it's relevant. */
export default function Helpful({ list, place, circleId, max = 3 }: { list: string; place: string; circleId: string; max?: number }) {
  const l = helpfulList(list);
  if (!l) return null;
  return (
    <section className="card pad helpful" aria-labelledby={`hf-${l.id}`}>
      <div className="row between"><h2 id={`hf-${l.id}`} style={{ margin: 0 }}>Helpful things: {l.title.toLowerCase()}</h2></div>
      <ul className="hf-list">
        {l.items.slice(0, max).map((i) => (
          <li key={i.id}>
            <a href={`/api/helpful/${i.id}?p=${place}`} target="_blank" rel="noopener sponsored">{i.name} ↗</a>
            <span className="small muted">{i.why}</span>
            {i.note && <span className="small hf-note">{i.note}</span>}
          </li>
        ))}
      </ul>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <Link href={`/c/${circleId}/helpful#${l.id}`} className="link small">See all ›</Link>
      </div>
      <Disclosure />
    </section>
  );
}
