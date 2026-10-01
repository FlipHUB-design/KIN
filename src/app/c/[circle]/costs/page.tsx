import Link from "next/link";
import { getCircle } from "@/lib/data";
import { balances, canEdit, dayLabel, expenseCategoriesFor, money, settleUp, sharesOf, today, type Child, type Expense, type Settlement } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { ChildPicker } from "../tasks/TaskForm";
import { addExpense, addMaintenance, addSettlement, deleteCost, approveExpense, queryExpense } from "../actions";

export default async function Costs({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, members, user, nameOf, me } = await getCircle(id);
  if (!canEdit(role)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Shared costs are visible to parents and family members only.</p></main>;
  const kidsMode = circle.kind === "children";
  const [{ data: ex }, { data: st }, { data: kidRows }] = await Promise.all([
    supabase.from("expenses").select("*").eq("circle_id", id).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("settlements").select("*").eq("circle_id", id).order("paid_on", { ascending: false }),
    kidsMode ? supabase.from("children").select("*").eq("circle_id", id).order("sort") : Promise.resolve({ data: [] }),
  ]);
  const E = (ex || []) as Expense[], S = (st || []) as Settlement[];
  const kids = (kidRows || []) as Child[];
  const fam = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  const net = balances(E, S);
  const plan = settleUp(net);
  const mine = net[user.id] || 0;
  const t = today();
  const monthStart = t.slice(0, 8) + "01";
  const approved = E.filter((e) => !e.status || e.status === "approved");
  const thisMonth = approved.filter((e) => e.spent_on >= monthStart).reduce((a, e) => a + e.amount_pence, 0);
  const toAnswer = E.filter((e) => e.status === "pending" && e.created_by !== user.id && e.paid_by !== user.id && e.split_between.includes(user.id));
  const waitingOthers = E.filter((e) => e.status === "pending" && !toAnswer.includes(e));
  const disputed = E.filter((e) => e.status === "disputed");
  const maintenance = S.filter((s) => s.kind === "maintenance");
  const yearStart = (Number(t.slice(5, 7)) >= 9 ? t.slice(0, 4) : String(Number(t.slice(0, 4)) - 1)) + "-09-01";
  const perChild = kids.map((k) => ({ k, total: approved.filter((e) => e.spent_on >= yearStart && (e.child_ids || []).includes(k.id)).reduce((a, e) => a + Math.round(e.amount_pence / Math.max(1, (e.child_ids || []).length)), 0) }));
  const split = circle.default_split || {};
  const feed = [
    ...E.map((e) => ({ kind: "expense" as const, date: e.spent_on, id: e.id, mine: e.created_by === user.id, text: e.description, status: e.status, child_ids: e.child_ids,
      removable: !kidsMode || e.status !== "approved",
      sub: `${nameOf(e.paid_by)} paid · ${e.shares ? Object.entries(sharesOf(e)).map(([k, v]) => `${nameOf(k)} ${money(v)}`).join(", ") : `split ${e.split_between.length === fam.length ? "equally" : e.split_between.map((x) => nameOf(x)).join(", ")}`} · ${e.category}`, amount: e.amount_pence })),
    ...S.filter((s) => s.kind !== "maintenance").map((s) => ({ kind: "settlement" as const, date: s.paid_on, id: s.id, mine: s.created_by === user.id, text: `${nameOf(s.from_user)} paid ${nameOf(s.to_user)}`, status: undefined, child_ids: [] as string[], removable: true, sub: s.note || "Settling up", amount: s.amount_pence })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const chips = (ids?: string[]) => (ids || []).map((cid) => { const k = kids.find((x) => x.id === cid); return k ? <span key={cid} className={`kid col-${k.colour}`}>{k.first_name}</span> : null; });

  return (
    <main className="page">
      <Header title={kidsMode ? "Costs" : "Shared costs"} sub={kidsMode ? "Shared costs for the children, and maintenance" : `Money the family spends on ${circle.preferred_name}`} initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/more`, label: "More" }} />
      <Notice sp={sp} />
      <section className={`status ${mine < 0 ? "attn" : "good"}`}>
        <div className="sline">{mine > 0 ? `You're owed ${money(mine)}` : mine < 0 ? `You owe ${money(-mine)}` : "You're all square"}</div>
        <p className="small" style={{ color: "var(--ink)" }}>{money(thisMonth)} of agreed costs this month.{toAnswer.length ? ` ${toAnswer.length} waiting for your approval.` : ""}</p>
      </section>

      {toAnswer.length > 0 && (
        <section className="stack" id="pending"><h2>Waiting for your approval</h2>
          {toAnswer.map((e) => (
            <div key={e.id} className="card pad reqcard">
              <div className="row between"><b>{e.description}</b><b>{money(e.amount_pence)}</b></div>
              <span className="small muted">{nameOf(e.paid_by)} paid on {dayLabel(e.spent_on)} · {e.category} {chips(e.child_ids)}</span>
              <span className="small">Your share: <b>{money(sharesOf(e)[user.id] || 0)}</b>{e.shares ? ` (${Object.entries(e.shares).map(([k, v]) => `${nameOf(k)} ${v}`).join(" / ")})` : ""}</span>
              <form className="stack">
                <Hidden circle={id} id={e.id} />
                <label className="fl"><span className="sr-only">Note</span><input name="note" placeholder="Add a note (optional), e.g. please add the receipt" maxLength={500} /></label>
                <div className="row"><button formAction={approveExpense} className="btn primary sm">Approve</button><button formAction={queryExpense} className="btn sm">Query it</button></div>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="stack">
        <h2>To settle up</h2>
        <div className="card list">
          {plan.length ? plan.map((p, i) => (
            <div key={i} className="item"><span className="main"><span className="t">{nameOf(p.from)} → {nameOf(p.to)}</span><span className="s">{plan.length > 1 ? "Fewest payments to square everyone up" : "To square up agreed costs"}</span></span><b>{money(p.amount)}</b></div>
          )) : <p className="empty">Everyone is square.</p>}
        </div>
        {fam.length > 2 && <div className="card work">
          {fam.map((m) => { const v = net[m.user_id] || 0; return (
            <div key={m.user_id} className="row between"><span>{nameOf(m.user_id)}</span><span style={{ fontVariantNumeric: "tabular-nums", color: v < 0 ? "var(--amber)" : "var(--accent)" }}>{v > 0 ? `owed ${money(v)}` : v < 0 ? `owes ${money(-v)}` : "square"}</span></div>
          ); })}
        </div>}
      </section>

      {(waitingOthers.length > 0 || disputed.length > 0) && (
        <section className="stack"><h2>Not counted yet</h2>
          <div className="card list">
            {[...waitingOthers, ...disputed].map((e) => (
              <div key={e.id} className="item"><span className="main"><span className="t">{e.description} {chips(e.child_ids)}</span>
                <span className="s"><span className={`tag ${e.status === "disputed" ? "over" : "unas"}`}>{e.status === "disputed" ? "Queried" : "Waiting for approval"}</span> {nameOf(e.paid_by)} paid {dayLabel(e.spent_on)}{e.response_note ? ` · ${nameOf(e.responded_by || null)}: “${e.response_note}”` : ""}</span></span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{money(e.amount_pence)}</b></div>
            ))}
          </div>
        </section>
      )}

      {kidsMode && perChild.some((p) => p.total) && (
        <section className="stack"><h2>Spent on each child since September</h2>
          <div className="card work">{perChild.map(({ k, total }) => (
            <div key={k.id} className="row between"><span className={`kid col-${k.colour}`}>{k.first_name}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{money(total)}</span></div>
          ))}</div>
          <span className="note">Agreed costs tagged with a child. Costs for several children are shared between them.</span>
        </section>
      )}

      <details className="card pad" open={!E.length}>
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Add a cost</summary>
        <form action={addExpense} className="form" style={{ marginTop: 12 }}>
          <Hidden circle={id} />
          <label className="fl">What was it?<input name="description" required maxLength={200} placeholder={kidsMode ? "e.g. School shoes" : "e.g. Weekly shopping"} /></label>
          <div className="two">
            <label className="fl">Amount (£)<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
            <label className="fl">Date<input type="date" name="spent_on" defaultValue={t} /></label>
          </div>
          <div className="two">
            <label className="fl">Paid by<select name="paid_by" defaultValue={user.id}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
            <label className="fl">Type<select name="category">{expenseCategoriesFor(circle.kind).map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          {kidsMode && <ChildPicker kids={kids} label="Which children is it for?" />}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
            <legend className="label" style={{ marginBottom: 6 }}>Split between{kidsMode ? " (in %)" : " equally"}</legend>
            <div className="row">{fam.map((m) => (
              <span key={m.user_id} className="row" style={{ gap: 4 }}>
                <label className="checkline"><input type="checkbox" name="split" value={m.user_id} defaultChecked /> {nameOf(m.user_id)}</label>
                {kidsMode && <input name={`w_${m.user_id}`} inputMode="numeric" aria-label={`${nameOf(m.user_id)} share in percent`} defaultValue={split[m.user_id] ?? Math.round(100 / fam.length)} style={{ width: 56, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)" }} />}
              </span>
            ))}</div>
            {kidsMode && <span className="note">Starts from your usual split. You can change it in Family settings.</span>}
          </fieldset>
          {kidsMode && <label className="checkline"><input type="checkbox" name="approval" value="skip" /> Already agreed, no approval needed</label>}
          {kidsMode && <p className="note">The other parent is asked to approve it. It counts in the balance once approved.</p>}
          <button className="btn primary">{kidsMode ? "Add cost" : "Add cost"}</button>
        </form>
      </details>

      <details className="card pad">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>Record a payment to settle up</summary>
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
              <span className="main"><span className="t">{f.text} {chips(f.child_ids)}</span><span className="s">{f.status && f.status !== "approved" && <span className={`tag ${f.status === "disputed" ? "over" : "unas"}`}>{f.status === "disputed" ? "Queried" : "Waiting"}</span>} {f.sub}</span></span>
              <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(f.amount)}</b>
                {(f.mine || role === "admin") && f.removable && <form action={deleteCost}><Hidden circle={id} id={f.id} /><input type="hidden" name="kind" value={f.kind} /><button className="link" style={{ fontSize: 13, color: "var(--muted)" }}>Remove</button></form>}</span>
            </div>
          ))}
          {!feed.length && <p className="empty">No shared costs yet.</p>}
        </div>
      </section>

      {kidsMode && (
        <section className="stack" id="maintenance">
          <h2>Child maintenance</h2>
          <p className="small muted">A record of maintenance payments, kept separate from shared costs. KIN doesn&apos;t work out or move any money.</p>
          <div className="card list">
            {maintenance.slice(0, 12).map((m) => (
              <div key={m.id} className="item"><span className="when">{dayLabel(m.paid_on).replace(/^\w+ /, "")}</span>
                <span className="main"><span className="t">{nameOf(m.from_user)} paid {nameOf(m.to_user)}</span><span className="s">{m.note || "Maintenance"} · recorded by {nameOf(m.created_by)}</span></span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.amount_pence)}</b></div>
            ))}
            {!maintenance.length && <p className="empty">No payments recorded.</p>}
          </div>
          <details className="card pad">
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>Record a maintenance payment</summary>
            <form action={addMaintenance} className="form" style={{ marginTop: 12 }}>
              <Hidden circle={id} />
              <div className="two">
                <label className="fl">From<select name="from_user" defaultValue={maintenance[0]?.from_user || user.id}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
                <label className="fl">To<select name="to_user" defaultValue={maintenance[0]?.to_user || ""}>{fam.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
              </div>
              <div className="two">
                <label className="fl">Amount (£)<input name="amount" inputMode="decimal" required defaultValue={maintenance[0] ? (maintenance[0].amount_pence / 100).toFixed(2) : ""} /></label>
                <label className="fl">Date paid<input type="date" name="paid_on" defaultValue={t} /></label>
              </div>
              <label className="fl">Note<input name="note" placeholder="e.g. Standing order, family-based arrangement" /></label>
              <button className="btn primary">Record payment</button>
            </form>
          </details>
          <a href="https://www.gov.uk/making-child-maintenance-arrangement" target="_blank" rel="noopener" className="link">Child maintenance on GOV.UK ↗</a>
        </section>
      )}
      <p className="note">{kidsMode ? "Only parents can see money." : "Only administrators and family members can see money."} KIN keeps a record; it doesn&apos;t move any money.{kidsMode ? ` Approvals are dated and kept in Records.` : ""}</p>
    </main>
  );
}
