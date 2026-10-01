import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { aiOn } from "@/lib/ai";
import Chat from "./Chat";

export default async function Ask({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/ask");
  const cid = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null;
  const [{ data: circle }, { data: m }] = cid
    ? await Promise.all([supabase.from("care_circles").select("kind").eq("id", cid).maybeSingle(), supabase.from("memberships").select("role").eq("circle_id", cid).eq("user_id", user.id).maybeSingle()])
    : [{ data: null }, { data: null }];
  const kids = circle?.kind === "children";
  const parent = m?.role === "admin" || m?.role === "family";
  const suggestions = !circle ? ["How do I set up a family?", "Who can see what?", "How do alerts work?"]
    : kids ? (parent ? ["How do I ask to swap days?", "How do shared costs work?", "How do I invite Grandma?", "Can I download a record?"] : ["How does the schedule work?", "How do I take on a job?", "How do alerts work?"])
    : (parent ? ["How do I invite someone?", "What is checking in?", "How do I claim Attendance Allowance?", "Who can see what?"] : ["How do I take on a job?", "What is checking in?", "How do alerts work?"]);
  return (
    <main className="page">
      <Link href={cid && circle ? `/c/${cid}` : "/circles"} className="link">‹ Back</Link>
      <h1>Ask KIN</h1>
      <p className="muted">Questions about how to do something in KIN.</p>
      <Chat circleId={circle ? cid : null} suggestions={suggestions} aiReady={aiOn()} />
    </main>
  );
}
