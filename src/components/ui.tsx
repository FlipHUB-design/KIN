import Link from "next/link";
import { dayLabel, hm, kindOf, isOverdue, RECURRENCE_LABEL, type Task } from "@/lib/kin";

export function Notice({ sp }: { sp: Record<string, string | undefined> }) {
  return (
    <>
      {sp.notice && <p className="ok" role="status">{sp.notice}</p>}
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
    </>
  );
}

export function Header({ title, sub, initial, back }: { title: string; sub?: string; initial: string; back?: { href: string; label: string } }) {
  return (
    <>
      {back && <Link href={back.href} className="link">‹ {back.label}</Link>}
      <div className="top">
        <div><Link href="/circles" className="brand">KIN</Link><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
        <Link href="/account" className="avatar" aria-label="Your account">{initial}</Link>
      </div>
    </>
  );
}

export type Row = { kind: string; when?: string; title: string; sub?: React.ReactNode; href?: string };

export function Rows({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <div className="card"><p className="empty">{empty}</p></div>;
  return (
    <div className="card list">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="bar" />
            {r.when !== undefined && <span className="when">{r.when}</span>}
            <span className="main"><span className="t">{r.title}</span>{r.sub && <span className="s">{r.sub}</span>}</span>
          </>
        );
        return r.href ? (
          <Link key={i} href={r.href} className={`item k-${r.kind}`}>{inner}</Link>
        ) : (
          <div key={i} className={`item k-${r.kind}`}>{inner}</div>
        );
      })}
    </div>
  );
}

export function taskRow(t: Task, base: string, nameOf: (id: string | null) => string, opts: { when?: "day" | "time" } = {}): Row {
  const bits: React.ReactNode[] = [];
  if (t.status === "done") bits.push(<span key="d" className="tag done">Done</span>);
  else if (isOverdue(t)) bits.push(<span key="o" className="tag over">Overdue</span>);
  bits.push(
    t.assignee ? <span key="a">{nameOf(t.assignee)}{t.category === "Transport" ? " driving" : t.category === "Pick-up or drop-off" ? " taking them" : ""}</span>
      : <span key="u" className="tag unas">{t.category === "Transport" ? "Who can drive?" : t.category === "Pick-up or drop-off" ? "Who can take them?" : "Who can do this?"}</span>
  );
  if (t.recurrence !== "none") bits.push(<span key="r">{RECURRENCE_LABEL[t.recurrence]}</span>);
  return {
    kind: kindOf(t),
    when: opts.when === "time" ? hm(t.due_time) : shortDay(t.due_date),
    title: t.title,
    href: `${base}/tasks/${t.id}`,
    sub: <>{bits.map((b, i) => <span key={i}>{i > 0 && " · "}{b}</span>)}</>,
  };
}

function shortDay(d: string | null) {
  const l = dayLabel(d);
  if (!d || ["Today", "Tomorrow", "Yesterday", "No date"].includes(l)) return l;
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      KIN helps families coordinate. It isn&apos;t a medical service. In an emergency call 999. For urgent medical advice call NHS 111.
    </p>
  );
}

export function Hidden({ circle, id, ret }: { circle: string; id?: string; ret?: string }) {
  return (
    <>
      <input type="hidden" name="circle" value={circle} />
      {id && <input type="hidden" name="id" value={id} />}
      {ret && <input type="hidden" name="return" value={ret} />}
    </>
  );
}
