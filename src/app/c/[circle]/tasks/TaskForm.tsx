import { categoriesFor, RECURRENCE_LABEL, today, type Child, type Kind, type Member, type Role, type Task } from "@/lib/kin";
import { Hidden } from "@/components/ui";

export function ChildPicker({ kids, selected, label = "Which children?" }: { kids: Child[]; selected?: string[]; label?: string }) {
  if (!kids.length) return null;
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
      <legend className="label" style={{ marginBottom: 6 }}>{label}</legend>
      <div className="row">
        {kids.map((k) => (
          <label key={k.id} className={`checkline kid col-${k.colour}`} style={{ padding: "4px 10px", fontSize: 14 }}>
            <input type="checkbox" name="child" value={k.id} defaultChecked={selected ? selected.includes(k.id) : kids.length === 1} /> {k.first_name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function TaskForm({ circle, members, userId, role, task, action, submit, kind, kids = [], defaults }: {
  circle: string; members: Member[]; userId: string; role: Role; task?: Task;
  action: (f: FormData) => Promise<void>; submit: string; kind?: Kind; kids?: Child[];
  defaults?: { title?: string; category?: string; child?: string };
}) {
  const family = role === "admin" || role === "family";
  const kidsMode = kind === "children";
  const who = members.filter((m) => m.role !== "supported" && m.status === "active" && (family || m.user_id === userId));
  return (
    <form action={action} className="form">
      <Hidden circle={circle} id={task?.id} />
      <label className="fl">What needs doing?<input name="title" defaultValue={task?.title || defaults?.title} required maxLength={140} placeholder={kidsMode ? "e.g. Sign the trip consent form" : "e.g. Pick up prescription"} /></label>
      {kidsMode && <ChildPicker kids={kids} selected={task?.child_ids || (defaults?.child ? [defaults.child] : undefined)} label="Which children is it for?" />}
      <div className="two">
        <label className="fl">Category<select name="category" defaultValue={task?.category || defaults?.category || "Other"}>{categoriesFor(kind).map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="fl">Who?<select name="assignee" defaultValue={task?.assignee || ""}>
          <option value="">Anyone (ask the {kidsMode ? "others" : "family"})</option>
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
      {family && <label className="checkline"><input type="checkbox" name="private" defaultChecked={task?.private} /> {kidsMode ? "Parents only (hidden from the children, grandparents and childminders)" : "Family only (hidden from contributors and helpers)"}</label>}
      {!kidsMode && <p className="note">Medication reminders are for reminding only. KIN never gives medical advice.</p>}
      <button className="btn primary block">{submit}</button>
    </form>
  );
}
