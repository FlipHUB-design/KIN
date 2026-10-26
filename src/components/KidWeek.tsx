import { today } from "@/lib/kin";
import { WEEKDAYS, weekdayOf } from "@/lib/support";

export type KidDay = { date: string; home: string | null; colour: string | null; lines: string[] };

const House = ({ colour }: { colour: string }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 30 L32 9 L56 30" fill="none" stroke={`var(--${colour})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="15" y="28" width="34" height="27" rx="4" fill={`var(--${colour})`} />
    <rect x="27" y="39" width="10" height="16" rx="2" fill="var(--surface)" />
  </svg>
);

/** A big, friendly week view for younger children: where they sleep and who's collecting them. */
export default function KidWeek({ name, days }: { name: string; days: KidDay[] }) {
  const t = today();
  return (
    <div className="kidweek">
      {days.map((d) => (
        <div key={d.date} className={`kidday${d.date === t ? " today" : ""}`} style={d.colour ? { borderColor: `var(--${d.colour})` } : undefined}>
          <div className="dname">{d.date === t ? "Today" : WEEKDAYS[weekdayOf(d.date)]}<div className="small muted" style={{ fontWeight: 400 }}>{Number(d.date.slice(8))} {new Date(d.date + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div></div>
          {d.colour ? <House colour={d.colour} /> : <span />}
          <div>
            <div className="home" style={d.colour ? { color: `var(--${d.colour})` } : undefined}>{d.home ? `${name} sleeps at ${d.home.replace(/'s$/, "'s house")}` : "Ask a grown-up"}</div>
            {d.lines.map((l, i) => <div key={i} className="pick">{l}</div>)}
          </div>
        </div>
      ))}
    </div>
  );
}
