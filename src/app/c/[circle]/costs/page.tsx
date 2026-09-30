import Link from "next/link";
import { getCircle } from "@/lib/data";
import { balances, canEdit, dayLabel, EXPENSE_CATEGORIES, money, settleUp, today, type Expense, type Settlement } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { addExpense, addSettlement, deleteCost } from "../actions";

export default async function Costs({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, members, user, nameOf, me } = await getCircle(id);
  if (!canEdit(role)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Shared costs are visible to family members only.</p></main>;
  const [{ data: ex }, { data: st }] = await Promise.all([
    supabase.from("expenses").select("*").eq("circle_id", id).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("settlements").select("*").eq("circle_id", id).order("paid_on", { ascending: false }),
  ]);
  const E = (ex || []) as Expense[], S = (st || []) as Settlement[];
  const fam = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  const net = balances(E, S);
  const plan = settleUp(net);
  const mine = net[user.id] || 0;
  const monthStart = today().slice(0, 8) + "01";
  const thisMonth = E.filter((e) => e.spent_on >= monthStart).reduce((a, e) => a + e.amount_pence, 0);
  const feed = [
    ...E.map((e) => ({ kind: "expense" as const, date: e.spent_on, id: e.id, mine: e.created_by === user.id, text: e.description, sub: `${nameOf(e.paid_by)} paid · split ${e.split_between.length === fam.length ? "between everyone" : e.split_between.map((x) => nameOf(x)).join(", ")} · ${e.category}`, amount: e.amount_pence })),
    ...S.map((s) => ({ kind: "settlement" as const, date: s.paid_on, id: s.id, mine: s.created_by === user.id, text: `${nameOf(s.from_user)} paid ${nameOf(s.to_user)}`, sub: s.note || "Settling up", amount: s.amount_pence })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  return (
    <main className="page">
      <Header title="Shared costs" sub={`Money the family spends on ${circle.preferred_name}`} initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/more`, label: "More" }} />
      <Notice sp={sp} />
      <section className={`status ${mine > 0 ? "good" : mine < 0 ? "attn" : "good"}`}>
        <div className="sline">{mine > 0 ? `You're owed ${money(mine)}` : mine < 0 ? `You owe ${money(-mine)}` : "You're all square"}</div>
        <p className="small" style={{ color: "var(--ink)" }}>{money(thisMonth)} spent this month across the family.</p>
      </section>
      <section className="stack">
        <h2>To settle up</h2>
        <div className="card list">
          {plan.length ? plan.map((p, i) => (
            <div key={i} className="item"><span className="main"><span className="t">{nameOf(p.from)} → {nameOf(p.to)}</span><span className="s">Fewest payments to square everyone up</span></span><b>{money(p.amount)}</b></div>
          )) : <p className="empty">Everyone is square.</p>}
        </div>
        <div className="card work">
          {fam.map((m) => { const v = net[m.user_id] || 0; return (
            <div key={m.user_id} className="row between"><span>{nameOf(m.user_id)}</span><span style={{ fontVariantNumeric: "tabular-nums", color: v < 0 ? "var(--amber)" : "var(--accent)" }}>{v > 0 ? `owed ${money(v)}` : v < 0 ? `owes ${money(-v)}` : "square"}</span></div>
          ); })}
        </div>
      </section>
      <details className="card pad" open={!E.length}>
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Add a cost</summary>
        <form action={addExpense} className="form" style={{ marginTop: 12 }}>
          <Hidden circle={id} />
          <label className="fl">What was it?<input name="description" required maxLength={200} placeholder="e.g. Weekly shopping" /></label>
          <div className="two">
            <label className="fl">Amount (£)<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
            <label className="fl">Date<input type="date" name="spent_on" defaultValue={today()} /></label>
          </div>
          <div className="two">
            <label className="fl">Paid by<select name="paid_by" defaultValue={user.id}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
            <label className="fl">Type<select name="category">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
            <legend className="label" style={{ marginBottom: 6 }}>Split equally between</legend>
            <div className="row">{fam.map((m) => <label key={m.user_id} className="checkline"><input type="checkbox" name="split" value={m.user_id} defaultChecked /> {nameOf(m.user_id)}</label>)}</div>
          </fieldset>
          <button className="btn primary">Add cost</button>
        </form>
      </details>
      <details className="card pad">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Record a payment between family</summary>
        <form action={addSettlement} className="form" style={{ marginTop: 12 }}>
          <Hidden circle={id} />
          <div className="two">
            <label className="fl">From<select name="from_user" defaultValue={plan[0]?.from || user.id}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
            <label className="fl">To<select name="to_user" defaultValue={plan[0]?.to || ""}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
          </div>
          <div className="two">
            <label className="fl">Amount (£)<input name="amount" inputMode="decimal" required defaultValue={plan[0] ? (plan[0].amount / 100).toFixed(2) : ""} /></label>
            <label className="fl">Note<input name="note" placeholder="e.g. Bank transfer" /></label>
          </div>
          <button className="btn primary">Record payment</button>
        </form>
      </details>
      <section className="stack">
        <h2>Recent</h2>
        <div className="card list">
          {feed.map((f) => (
            <div key={f.kind + f.id} className="item">
              <span className="when">{dayLabel(f.date).replace(/^\w+ /, "")}</span>
              <span className="main"><span className="t">{f.text}</span><span className="s">{f.sub}</span></span>
              <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(f.amount)}</b>
                {(f.mine || role === "admin") && <form action={deleteCost}><Hidden circle={id} id={f.id} /><input type="hidden" name="kind" value={f.kind} /><button className="link" style={{ fontSize: 13, color: "var(--muted)" }}>Remove</button></form>}</span>
            </div>
          ))}
          {!feed.length && <p className="empty">No shared costs yet.</p>}
        </div>
      </section>
      <p className="note">Only administrators and family members can see shared costs. KIN keeps a record; it doesn&apos;t move any money.</p>
    </main>
  );
}
