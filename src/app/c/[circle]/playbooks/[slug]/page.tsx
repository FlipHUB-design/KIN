import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { addDays, canEdit, dayLabel, today } from "@/lib/kin";
import { playbook } from "@/lib/playbooks";
import { Hidden, Notice } from "@/components/ui";
import { startPlaybook } from "../../actions";

export default async function PlaybookPage({ params, searchParams }: { params: Promise<{ circle: string; slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id, slug } = await params;
  const sp = await searchParams;
  const pb = playbook(slug);
  if (!pb) notFound();
  const { role, members, user } = await getCircle(id);
  const who = members.filter((m) => ["admin", "family", "contributor"].includes(m.role) && m.status === "active");
  const start = today();
  return (
    <main className="page">
      <Link href={`/c/${id}/playbooks`} className="link">‹ Playbooks</Link>
      <h1>{pb.title}</h1>
      <p className="muted">{pb.summary}</p>
      <a href={pb.link} target="_blank" rel="noopener" className="link">{pb.linkLabel} ↗</a>
      <Notice sp={sp} />
      <form action={startPlaybook} className="form">
        <Hidden circle={id} /><input type="hidden" name="slug" value={pb.slug} />
        <div className="card list">
          {pb.steps.map((st, i) => (
            <label key={i} className="item" style={{ alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" name="step" value={i} defaultChecked style={{ marginTop: 4 }} disabled={!canEdit(role)} />
              <span className="main"><span className="t">{st.title}</span><span className="s">{st.detail}</span>
                <span className="s">{st.offset === 0 ? "On the day" : st.offset < 0 ? `${-st.offset} day${st.offset === -1 ? "" : "s"} before` : `${st.offset} day${st.offset === 1 ? "" : "s"} after`}
                  {" · "}{dayLabel(addDays(start, st.offset))} if you start today{st.private ? " · Family only" : ""}</span>
                {st.link && <a href={st.link} target="_blank" rel="noopener" className="s" style={{ color: "var(--accent)" }}>Official guidance ↗</a>}</span>
            </label>
          ))}
        </div>
        {canEdit(role) ? (
          <>
            <div className="two">
              <label className="fl">{pb.startLabel}<input type="date" name="start" defaultValue={start} required />{pb.startHint && <span className="note">{pb.startHint}</span>}</label>
              <label className="fl">Who&apos;s leading?<select name="assignee" defaultValue={user.id}>
                <option value="">Anyone (ask the family)</option>
                {who.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}{m.user_id === user.id ? " (you)" : ""}</option>)}
              </select></label>
            </div>
            <button className="btn primary block">Add the ticked steps as tasks</button>
            <p className="note">You can reassign or change any task afterwards.</p>
          </>
        ) : <p className="note">Family members can start playbooks.</p>}
      </form>
    </main>
  );
}
