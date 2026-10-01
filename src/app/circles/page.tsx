import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { circleStatus, type Appointment, type Checkin, type Circle, type Task, today, addDays } from "@/lib/kin";

export default async function Circles() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: rows } = await supabase
    .from("memberships")
    .select("role, status, care_circles(*)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const circles = (rows || []).map((r) => ({ role: r.role as string, circle: r.care_circles as unknown as Circle }));
  if (circles.length === 1) redirect(`/c/${circles[0].circle.id}`);
  const ids = circles.map((c) => c.circle.id);
  const since = addDays(today(), -1);
  const [{ data: tasks }, { data: appts }, { data: checkins }] = ids.length
    ? await Promise.all([
        supabase.from("tasks").select("*").in("circle_id", ids).in("status", ["open", "accepted"]),
        supabase.from("appointments").select("*").in("circle_id", ids).gte("date", today()),
        supabase.from("checkins").select("*").in("circle_id", ids).gte("checked_in_at", since),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();

  return (
    <main className="page">
      <div className="top">
        <div><span className="brand">KIN</span><h1>Your families</h1></div>
        <Link href="/account" className="avatar" aria-label="Your account">{(me?.display_name || "?")[0]}</Link>
      </div>
      {circles.length === 0 ? (
        <div className="card pad">
          <h2>Welcome{me?.display_name ? `, ${me.display_name.split(" ")[0]}` : ""}</h2>
          <p>Set up a family for your children, or a Care Circle for an older relative. You can invite everyone else straight after.</p>
          <p className="note">Been invited by someone else? Open the invitation link they sent you.</p>
          <Link href="/circles/new" className="btn primary">Get started</Link>
        </div>
      ) : (
        <>
          <div className="card list">
            {circles.map(({ circle }) => {
              const s = circleStatus({
                circle,
                tasks: ((tasks || []) as Task[]).filter((t) => t.circle_id === circle.id),
                appts: ((appts || []) as Appointment[]).filter((a) => a.circle_id === circle.id),
                checkins: ((checkins || []) as Checkin[]).filter((c) => c.circle_id === circle.id),
                dismissedToday: circle.checkin_dismissed_on === today(),
              });
              const c = ["accent", "amber", "coral"][s.level];
              return (
                <Link key={circle.id} href={`/c/${circle.id}`} className="item">
                  <span className="avatar">{circle.preferred_name[0]}</span>
                  <span className="main"><span className="t">{circle.person_name}</span>
                    <span className="s">{s.reasons[0] || "Everything has someone looking after it"}</span></span>
                  <span className="tag" style={{ ["--c" as string]: `var(--${c})`, ["--cs" as string]: `var(--${c}-soft)` }}>{s.label}</span>
                </Link>
              );
            })}
          </div>
          <Link href="/circles/new" className="btn">Add a family or Care Circle</Link>
        </>
      )}
    </main>
  );
}
