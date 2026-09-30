import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircle } from "@/lib/data";
import { canEdit, dayLabel, hm, isOverdue, kindOf, RECURRENCE_LABEL, when, type Task } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import TaskForm from "../TaskForm";
import { addComment, cancelTask, claimTask, completeTask, declineTask, updateTask } from "../../actions";

export default async function TaskPage({ params, searchParams }: { params: Promise<{ circle: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: cid, id } = await params;
  const sp = await searchParams;
  const { supabase, user, role, nameOf, members } = await getCircle(cid);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("tasks").select("*").eq("id", id).eq("circle_id", cid).maybeSingle();
  if (!data) notFound();
  const t = data as Task;
  const showComments = role !== "helper";
  const { data: comments } = showComments
    ? await supabase.from("task_comments").select("*").eq("task_id", id).order("created_at")
    : { data: [] };
  const mine = t.assignee === user.id;
  const transport = t.category === "Transport";
  const canTake = role !== "helper";
  const editing = sp.edit === "1" && canEdit(role);
  const back = t.appointment_id ? { href: `/c/${cid}/appointments/${t.appointment_id}`, label: "Appointment" } : { href: `/c/${cid}/tasks`, label: "Tasks" };

  if (editing) return (
    <main className="page">
      <Link href={`/c/${cid}/tasks/${id}`} className="link">‹ Cancel</Link>
      <h1>Edit task</h1>
      <TaskForm circle={cid} members={members} userId={user.id} role={role} task={t} action={updateTask} submit="Save changes" />
    </main>
  );

  return (
    <main className="page">
      <Link href={back.href} className="link">‹ {back.label}</Link>
      <Notice sp={sp} />
      <div className={`row k-${kindOf(t)}`}><span className="tag">{t.category}</span>{t.private && <span className="tag">Family only</span>}</div>
      <h1>{t.title}</h1>
      <p className="muted">
        {dayLabel(t.due_date)}{t.due_time ? ` at ${hm(t.due_time)}` : ""}{t.recurrence !== "none" ? ` · ${RECURRENCE_LABEL[t.recurrence]}` : ""}
        {isOverdue(t) && <> · <span className="tag over">Overdue</span></>}
      </p>
      {t.description && <p style={{ whiteSpace: "pre-line" }}>{t.description}</p>}
      {t.link_url && <a href={t.link_url} target="_blank" rel="noopener" className="link">Official guidance ↗</a>}
      {t.source?.startsWith("letter:") && canEdit(role) && <Link href={`/c/${cid}/letters/${t.source.slice(7)}`} className="link">From a letter KIN read</Link>}
      {t.source?.startsWith("playbook:") && <Link href={`/c/${cid}/playbooks/${t.source.slice(9)}`} className="link">Part of a playbook</Link>}

      {t.status === "done" ? (
        <div className="callout">Done by {nameOf(t.completed_by)} {t.completed_at ? when(t.completed_at).toLowerCase() : ""}</div>
      ) : t.status === "cancelled" ? (
        <div className="callout amber">Cancelled</div>
      ) : !t.assignee ? (
        <>
          <div className="callout amber">{transport ? "Who can drive?" : "Who can do this?"}</div>
          {canTake && <form action={claimTask}><Hidden circle={cid} id={id} /><button className="btn primary block">{transport ? "I'll drive" : "I'll do it"}</button></form>}
        </>
      ) : (
        <>
          <div className="callout">{mine ? "You're" : `${nameOf(t.assignee)} is`} {transport ? "driving" : "responsible"}</div>
          <div className="row">
            {(mine || canEdit(role)) && <form action={completeTask}><Hidden circle={cid} id={id} /><button className="btn primary">{mine ? "Mark done" : `Mark done for ${nameOf(t.assignee)}`}</button></form>}
            {mine && <form action={declineTask}><Hidden circle={cid} id={id} /><button className="btn">I can&apos;t do this any more</button></form>}
          </div>
        </>
      )}

      {showComments && (
        <section className="stack" id="comments">
          <span className="label">Comments</span>
          {(comments || []).map((c) => (
            <div key={c.id} className="comment"><span className="avatar sm">{nameOf(c.author)[0]}</span>
              <div className="bub"><b>{nameOf(c.author)} · {when(c.created_at)}</b>{c.body}</div></div>
          ))}
          {!comments?.length && <p className="small muted">No comments yet.</p>}
          <form action={addComment} className="row" style={{ flexWrap: "nowrap" }}>
            <Hidden circle={cid} id={id} />
            <label className="fl" style={{ flex: 1 }}><span className="sr-only">Add a comment</span><input name="body" placeholder="Add a comment" autoComplete="off" maxLength={2000} /></label>
            <button className="btn primary">Post</button>
          </form>
        </section>
      )}

      {canEdit(role) && t.status !== "done" && t.status !== "cancelled" && (
        <div className="row between">
          <Link href={`/c/${cid}/tasks/${id}?edit=1`} className="link">Edit task</Link>
          <form action={cancelTask}><Hidden circle={cid} id={id} /><button className="link" style={{ color: "var(--coral)" }}>Cancel this task</button></form>
        </div>
      )}
    </main>
  );
}
