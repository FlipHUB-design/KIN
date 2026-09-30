import Link from "next/link";
import { getCircle } from "@/lib/data";
import { Notice } from "@/components/ui";
import TaskForm from "../TaskForm";
import { createTask } from "../../actions";

export default async function NewTask({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { members, user, role } = await getCircle(id);
  return (
    <main className="page">
      <Link href={`/c/${id}/tasks`} className="link">‹ Tasks</Link>
      <h1>New task</h1>
      <Notice sp={sp} />
      <TaskForm circle={id} members={members} userId={user.id} role={role} action={createTask} submit="Add task" />
    </main>
  );
}
