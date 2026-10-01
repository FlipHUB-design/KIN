import Link from "next/link";
import { getCircle } from "@/lib/data";
import { AGREEMENT_CATEGORIES, canEdit, when, type Agreement } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { proposeAgreement, respondAgreementAction, withdrawAgreementAction } from "../actions";

export default async function Agreements({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, user, nameOf, me } = await getCircle(id);
  const base = `/c/${id}`;
  const parent = canEdit(role);
  const { data } = await supabase.from("agreements").select("*").eq("circle_id", id).order("proposed_at", { ascending: false });
  const A = (data || []) as Agreement[];
  const waiting = A.filter((a) => a.status === "proposed" && a.proposed_by !== user.id);
  const mine = A.filter((a) => a.status === "proposed" && a.proposed_by === user.id);
  const agreed = A.filter((a) => a.status === "agreed");
  const cats = AGREEMENT_CATEGORIES.filter((c) => agreed.some((a) => a.category === c));
  const other = A.filter((a) => a.status === "declined" || a.status === "withdrawn").slice(0, 10);
  return (
    <main className="page">
      <Header title={parent ? "Agreements" : "Rules in both homes"} sub={parent ? "What you've agreed, so nobody has to remember" : undefined} initial={(me.profiles?.display_name || "?")[0]} back={{ href: base, label: "Home" }} />
      <Notice sp={sp} />
      {waiting.length > 0 && (
        <section className="stack"><h2>Waiting for your answer</h2>
          {waiting.map((a) => (
            <div key={a.id} className="card pad reqcard">
              <span className="label">{a.category}</span><b>{a.title}</b>{a.detail && <p className="small">{a.detail}</p>}
              <p className="note">Proposed by {nameOf(a.proposed_by)} {when(a.proposed_at).toLowerCase()}{a.share ? " · will be shared with grandparents, childminders and the children" : " · parents only"}</p>
              <form action={respondAgreementAction} className="stack">
                <Hidden circle={id} id={a.id} />
                <label className="fl"><span className="sr-only">Note</span><input name="note" placeholder="Add a note (optional)" maxLength={500} /></label>
                <div className="row"><button name="answer" value="yes" className="btn primary sm">Agree</button><button name="answer" value="no" className="btn sm">Not agreed</button></div>
              </form>
            </div>
          ))}
        </section>
      )}
      <section className="stack"><h2>{parent ? "Agreed" : "Agreed by your parents"}</h2>
        {cats.map((c) => (
          <div key={c} className="stack" style={{ gap: 6 }}>
            <span className="label">{c}</span>
            <div className="card list">
              {agreed.filter((a) => a.category === c).map((a) => (
                <div key={a.id} className="item" style={{ alignItems: "flex-start" }}>
                  <span className="main"><span className="t">{a.title}</span>{a.detail && <span className="s" style={{ whiteSpace: "pre-line" }}>{a.detail}</span>}
                    {parent && <span className="s">Proposed by {nameOf(a.proposed_by)}, agreed by {nameOf(a.decided_by)} {a.decided_at ? when(a.decided_at).toLowerCase() : ""}{a.share ? " · shared with everyone" : " · parents only"}</span>}</span>
                  {parent && <form action={withdrawAgreementAction}><Hidden circle={id} id={a.id} /><button className="link small" style={{ color: "var(--muted)" }}>Withdraw</button></form>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {!agreed.length && <p className="muted">Nothing agreed yet.</p>}
      </section>
      {parent && mine.length > 0 && (
        <section className="stack"><h2>You&apos;ve proposed</h2>
          <div className="card list">{mine.map((a) => (
            <div key={a.id} className="item"><span className="main"><span className="t">{a.title}</span><span className="s">Waiting for another parent · {when(a.proposed_at).toLowerCase()}</span></span>
              <form action={withdrawAgreementAction}><Hidden circle={id} id={a.id} /><button className="btn sm">Withdraw</button></form></div>
          ))}</div>
        </section>
      )}
      {parent && (
        <details className="card pad" open={!A.length}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>Propose an agreement</summary>
          <form action={proposeAgreement} className="form" style={{ marginTop: 12 }}>
            <Hidden circle={id} />
            <label className="fl">What would you like to agree?<input name="title" required maxLength={140} placeholder="e.g. Bedtime is 8pm on school nights in both homes" /></label>
            <label className="fl">Details (optional)<textarea name="detail" maxLength={2000} /></label>
            <label className="fl">Topic<select name="category">{AGREEMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="checkline"><input type="checkbox" name="share" /> Once agreed, show it to grandparents, childminders and the children</label>
            <p className="note">It only counts once another parent agrees. Every step is kept with the date and who did it.</p>
            <button className="btn primary">Propose</button>
          </form>
        </details>
      )}
      {parent && other.length > 0 && (
        <section className="stack"><h2>Not agreed or withdrawn</h2>
          <div className="card list">{other.map((a) => (
            <div key={a.id} className="item"><span className="main"><span className="t">{a.title}</span><span className="s">{a.status === "declined" ? `Not agreed by ${nameOf(a.decided_by)}` : "Withdrawn"}{a.note ? `: “${a.note}”` : ""}</span></span></div>
          ))}</div>
        </section>
      )}
      {parent && <Link href={`${base}/records`} className="link">Full record of changes</Link>}
    </main>
  );
}
