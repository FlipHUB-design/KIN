import Link from "next/link";
import { getCircle } from "@/lib/data";
import type { Child } from "@/lib/kin";
import { Notice } from "@/components/ui";
import TaskForm from "../TaskForm";
import { createTask } from "../../actions";

export default async function NewTask({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { members, user, role, circle, supabase } = await getCircle(id);
  const { data: kids } = circle.kind === "children" ? await supabase.from("children").select("*").eq("circle_id", id).order("sort") : { data: [] };
  return (
    <main className="page">
      <Link href={`/c/${id}/tasks`} className="link">‹ Tasks</Link>
      <h1>New task</h1>
      <Notice sp={sp} />
      <TaskForm circle={id} members={members} userId={user.id} role={role} action={createTask} submit="Add task" kind={circle.kind} kids={(kids || []) as Child[]}
        defaults={{ title: sp.title, category: sp.category, child: sp.child }} />
    </main>
  );
}
