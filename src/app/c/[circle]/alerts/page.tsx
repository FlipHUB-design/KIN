import Link from "next/link";
import { getCircle } from "@/lib/data";
import { LEVEL_LABEL, deliveryText, type Level } from "@/lib/notify";

const when = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
  return day === today ? `Today at ${time}` : `${day} at ${time}`;
};

export default async function AlertsPage({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, user, circle } = await getCircle(id);
  const { data: alerts } = await supabase.from("notifications").select("*").eq("circle_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
  const unread = (alerts || []).filter((a) => !a.read_at).map((a) => a.id);
  if (unread.length) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
  const kids = circle.kind === "children";
  return (
    <main className="page">
      <Link href={`/c/${id}`} className="link">‹ Home</Link>
      <h1>Alerts</h1>
      <p className="muted">Things {kids ? "the family" : "the circle"} needed you to know. You choose which come by email or text.</p>
      <Link href="/account/alerts" className="btn">Email and text settings</Link>
      {!alerts?.length ? (
        <div className="card pad"><p className="muted">No alerts yet. You&apos;ll see one here when someone {kids ? "asks to change the schedule, adds a cost for you to approve," : "gives you a job,"} or needs your answer.</p></div>
      ) : (
        <div className="card">
          {alerts.map((a) => (
            <Link key={a.id} href={`/c/${id}${a.link || ""}`} className={`alert${unread.includes(a.id) ? " unread" : ""}`}>
              <span className={`lvl ${a.level}`}>{LEVEL_LABEL[a.level as Level]}{unread.includes(a.id) ? " · New" : ""}</span>
              <b>{a.title}</b>
              {a.body && <span className="small">{a.body}</span>}
              <span className="note">{when(a.created_at)} · {deliveryText(a.email_status, a.sms_status)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
