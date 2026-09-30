import Link from "next/link";
import { getCircle } from "@/lib/data";
import { type Task } from "@/lib/kin";
import { Header, Notice, Rows, taskRow } from "@/components/ui";

const FILTERS = [["open", "Open"], ["mine", "Mine"], ["unassigned", "Who can do this?"], ["done", "Done"]] as const;

export default async function Tasks({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, user, role, nameOf, me } = await getCircle(id);
  const f = sp.f || "open";
  let q = supabase.from("tasks").select("*").eq("circle_id", id);
  if (f === "done") q = q.eq("status", "done").order("completed_at", { ascending: false }).limit(50);
  else {
    q = q.in("status", ["open", "accepted"]).order("due_date", { nullsFirst: false });
    if (f === "mine") q = q.eq("assignee", user.id);
    if (f === "unassigned") q = q.is("assignee", null);
  }
  const { data } = await q;
  const base = `/c/${id}`;
  return (
    <main className="page">
      <Header title="Tasks" sub={circle.person_name} initial={(me.profiles?.display_name || "?")[0]} />
      <Notice sp={sp} />
      <nav className="chips" aria-label="Filter tasks">
        {FILTERS.map(([k, l]) => <Link key={k} href={`${base}/tasks?f=${k}`} className="chip" aria-current={f === k}>{l}</Link>)}
      </nav>
      <Rows rows={((data || []) as Task[]).map((t) => taskRow(t, base, nameOf))} empty={f === "mine" ? "Nothing assigned to you." : "No tasks here."} />
      <Link href={`${base}/tasks/new`} className="btn primary block">Add task</Link>
      {role === "contributor" && <p className="note">As a contributor you see your own tasks and open tasks the family has shared. Private family tasks stay hidden.</p>}
    </main>
  );
}
