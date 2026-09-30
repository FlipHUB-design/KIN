import { CATEGORIES, RECURRENCE_LABEL, today, type Member, type Role, type Task } from "@/lib/kin";
import { Hidden } from "@/components/ui";

export default function TaskForm({ circle, members, userId, role, task, action, submit }: {
  circle: string; members: Member[]; userId: string; role: Role; task?: Task;
  action: (f: FormData) => Promise<void>; submit: string;
}) {
  const family = role === "admin" || role === "family";
  const who = members.filter((m) => m.role !== "supported" && m.status === "active" && (family || m.user_id === userId));
  return (
    <form action={action} className="form">
      <Hidden circle={circle} id={task?.id} />
      <label className="fl">What needs doing?<input name="title" defaultValue={task?.title} required maxLength={140} placeholder="e.g. Pick up prescription" /></label>
      <div className="two">
        <label className="fl">Category<select name="category" defaultValue={task?.category || "Other"}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="fl">Who?<select name="assignee" defaultValue={task?.assignee || ""}>
          <option value="">Anyone (ask the family)</option>
          {who.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}{m.user_id === userId ? " (you)" : ""}</option>)}
        </select></label>
      </div>
      <div className="two">
        <label className="fl">Due<input type="date" name="due_date" defaultValue={task?.due_date || today()} /></label>
        <label className="fl">Time<input type="time" name="due_time" defaultValue={task?.due_time?.slice(0, 5) || ""} /></label>
      </div>
      <label className="fl">Repeats<select name="recurrence" defaultValue={task?.recurrence || "none"}>
        {Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
      <label className="fl">Details<textarea name="description" defaultValue={task?.description || ""} maxLength={2000} /></label>
      {family && <label className="checkline"><input type="checkbox" name="private" defaultChecked={task?.private} /> Family only (hidden from contributors and helpers)</label>}
      <p className="note">Medication reminders are for reminding only. KIN never gives medical advice.</p>
      <button className="btn primary block">{submit}</button>
    </form>
  );
}
