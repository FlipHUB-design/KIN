import Link from "next/link";
import { redirect } from "next/navigation";
import { KIND_LABEL, ownerOnly, type WaitRow } from "@/lib/owner";
import { site } from "@/lib/notify";
import { revalidatePath } from "next/cache";
import { affiliateOn, helpfulItem } from "@/lib/helpful";

async function setHelpful(f: FormData) {
  "use server";
  const { ok, admin } = await ownerOnly();
  if (!ok || !admin) return;
  await admin.from("app_settings").upsert({ key: "helpful", value: { on: f.get("on") === "1" }, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
  redirect("/admin#helpful");
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner dashboard · Many Hands" };

type U = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null };
type Circle = { id: string; kind: string | null; created_by: string | null; created_at: string };
type Member = { circle_id: string; user_id: string; role: string; status: string };

const DAY = 86400000;
const isDemo = (e: string | null | undefined) => !!e && e.endsWith("@kin-demo.example.com");
const ago = (s: string | null) => (s ? Date.now() - Date.parse(s) : Infinity);
const short = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : "never");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
// Rough cost per AI use, in pence: an estimate to keep an eye on spend, not a bill
const AI_PENCE: Record<string, number> = { setup: 2, help: 0.3, letter: 1, tone: 0.2, email: 1, transcribe: 6 };
const AI_LABEL: Record<string, string> = { setup: "Guided setup", help: "Ask Many Hands", letter: "Letter reading", tone: "Check my tone", email: "School emails", transcribe: "Recording write-ups" };

/** Monday-starting weeks, oldest first, for the last n weeks. */
function weeks(n: number) {
  const now = new Date(); const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7));
  return Array.from({ length: n }, (_, i) => new Date(mon.getTime() - (n - 1 - i) * 7 * DAY));
}
const weekIndex = (ws: Date[], s: string) => { const t = Date.parse(s); for (let i = ws.length - 1; i >= 0; i--) if (t >= ws[i].getTime()) return i; return -1; };

function Bars({ series, labels }: { series: { name: string; colour: string; values: number[] }[]; labels: string[] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div className="ad-chart" role="img" aria-label={series.map((s) => `${s.name}: ${s.values.join(", ")}`).join("; ")}>
      <div className="ad-bars">
        {labels.map((l, i) => (
          <div key={l} className="ad-col">
            <div className="ad-stack">
              {series.map((s) => <span key={s.name} className="ad-bar" style={{ height: `${(s.values[i] / max) * 100}%`, background: s.colour }} title={`${s.name}: ${s.values[i]}`} />)}
            </div>
            <span className="ad-x">{l}</span>
          </div>
        ))}
      </div>
      <div className="ad-key">{series.map((s) => <span key={s.name}><i style={{ background: s.colour }} />{s.name}</span>)}</div>
    </div>
  );
}

const Stat = ({ n, label, sub }: { n: string | number; label: string; sub?: string }) => (
  <div className="card pad ad-stat"><b>{n}</b><span>{label}</span>{sub && <span className="small muted">{sub}</span>}</div>
);

/** The owner's overview: accounts, families, activity, costs and the waiting list. Counts only: no family's own content is shown. */
export default async function OwnerDashboard() {
  const { user, ok, configured, admin } = await ownerOnly();
  if (!user) redirect("/login?next=/admin");
  if (!ok || !admin) return (
    <main className="page"><h1>Owner dashboard</h1>
      <p className="muted">{configured ? "This page is only for the Many Hands team." : "Add ADMIN_EMAILS (your email address) in Vercel's environment variables, then redeploy, to open this page."}</p>
      <Link href="/" className="link">‹ Home</Link></main>
  );

  // Every account (paged)
  const users: U[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = (data?.users || []) as unknown as U[];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const [circlesQ, membersQ, activityQ, notifQ, aiQ, waitQ, recQ, tasksQ, apptsQ, lettersQ, clicksQ, settingQ, optQ] = await Promise.all([
    admin.from("care_circles").select("id, kind, created_by, created_at"),
    admin.from("memberships").select("circle_id, user_id, role, status"),
    admin.from("activity").select("circle_id, actor, verb, created_at").gte("created_at", since30).limit(50000),
    admin.from("notifications").select("user_id, email_status, sms_status, created_at").gte("created_at", since30).limit(50000),
    admin.from("ai_usage").select("user_id, kind, count, day").gte("day", since30.slice(0, 10)),
    admin.from("waitlist").select("*").order("created_at", { ascending: false }),
    admin.from("appointment_recordings").select("circle_id, status, created_at").gte("created_at", since30),
    admin.from("tasks").select("circle_id, created_at").gte("created_at", since30).limit(50000),
    admin.from("appointments").select("circle_id, created_at").gte("created_at", since30).limit(50000),
    admin.from("letter_scans").select("circle_id, created_at").gte("created_at", since30).limit(50000),
    admin.from("helpful_clicks").select("item, place, created_at").gte("created_at", since30).limit(50000),
    admin.from("app_settings").select("value").eq("key", "helpful").maybeSingle(),
    admin.from("profiles").select("id").eq("marketing_opt_in", true),
  ]);
  const helpfulIsOn = settingQ.data?.value?.on !== false;
  const clicks = (clicksQ.data || []) as { item: string; place: string | null; created_at: string }[];
  const clickItems = Object.entries(clicks.reduce<Record<string, number>>((acc, c) => { acc[c.item] = (acc[c.item] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const clickPlaces = Object.entries(clicks.reduce<Record<string, number>>((acc, c) => { const k = c.place || "page"; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);

  // Leave the demo families out of everything
  const demoIds = new Set(users.filter((u) => isDemo(u.email)).map((u) => u.id));
  const real = users.filter((u) => !demoIds.has(u.id));
  const realIds = new Set(real.map((u) => u.id));
  const circles = ((circlesQ.data || []) as Circle[]).filter((c) => !c.created_by || !demoIds.has(c.created_by));
  const circleIds = new Set(circles.map((c) => c.id));
  const members = ((membersQ.data || []) as Member[]).filter((m) => circleIds.has(m.circle_id) && m.status === "active");
  const inReal = <T extends { circle_id: string | null }>(rows: T[] | null) => (rows || []).filter((r) => r.circle_id && circleIds.has(r.circle_id));
  const activity = inReal(activityQ.data as { circle_id: string; actor: string | null; verb: string; created_at: string }[]);
  const notifs = ((notifQ.data || []) as { user_id: string; email_status: string | null; sms_status: string | null; created_at: string }[]).filter((n) => realIds.has(n.user_id));
  const ai = ((aiQ.data || []) as { user_id: string; kind: string; count: number }[]).filter((a) => realIds.has(a.user_id));
  const wait = (waitQ.data || []) as WaitRow[];
  const optUsers = (optQ.data || []).filter((p: { id: string }) => realIds.has(p.id)).length;
  const optWait = wait.filter((w) => w.marketing_opt_in).length;
  const recs = inReal(recQ.data as { circle_id: string; status: string; created_at: string }[]);

  // Accounts
  const new7 = real.filter((u) => ago(u.created_at) < 7 * DAY).length;
  const new30 = real.filter((u) => ago(u.created_at) < 30 * DAY).length;
  const active7 = real.filter((u) => ago(u.last_sign_in_at) < 7 * DAY).length;
  const active30 = real.filter((u) => ago(u.last_sign_in_at) < 30 * DAY).length;
  const inACircle = new Set(members.map((m) => m.user_id));

  // Families
  const care = circles.filter((c) => c.kind !== "children").length, kids = circles.length - care;
  const perCircle = circles.map((c) => members.filter((m) => m.circle_id === c.id).length);
  const avgMembers = perCircle.length ? (perCircle.reduce((a, b) => a + b, 0) / perCircle.length).toFixed(1) : "0";
  const activeCircles7 = new Set(activity.filter((a) => ago(a.created_at) < 7 * DAY).map((a) => a.circle_id));
  const teamCircles = circles.filter((c) => new Set(activity.filter((a) => a.circle_id === c.id && a.actor).map((a) => a.actor)).size >= 2).length;
  const roles = members.reduce<Record<string, number>>((acc, m) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {});

  // Growth chart
  const ws = weeks(12);
  const labels = ws.map((d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }));
  const perWeek = (dates: string[]) => { const v = ws.map(() => 0); dates.forEach((d) => { const i = weekIndex(ws, d); if (i >= 0) v[i]++; }); return v; };

  // Costs (last 30 days)
  const texts = notifs.filter((n) => n.sms_status === "sent").length;
  const emails = notifs.filter((n) => n.email_status === "sent").length;
  const aiByKind = Object.entries(ai.reduce<Record<string, number>>((acc, a) => { acc[a.kind] = (acc[a.kind] || 0) + a.count; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const aiPence = aiByKind.reduce((s, [k, n]) => s + (AI_PENCE[k] || 1) * n, 0);
  const textPence = texts * 4;

  // Waiting list
  const wait7 = wait.filter((w) => ago(w.created_at) < 7 * DAY).length;
  const waitKinds = Object.entries(wait.reduce<Record<string, number>>((acc, w) => { acc[w.kind] = (acc[w.kind] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const waitSources = Object.entries(wait.reduce<Record<string, number>>((acc, w) => { const k = w.source || "direct"; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const waitEmails = new Set(wait.map((w) => w.email.toLowerCase()));
  const converted = real.filter((u) => u.email && waitEmails.has(u.email.toLowerCase())).length;

  // Most used features (last 30 days), from the activity log
  const feature = (v: string) =>
    /check(ed)? ?in|checked out/.test(v) ? "Check-ins" : /appointment|driver/.test(v) ? "Appointments" : /task|job|said they'll|done/.test(v) ? "Tasks and jobs"
    : /letter|email/.test(v) ? "Letters and emails" : /cost|paid|expense|settle/.test(v) ? "Shared costs" : /swap|schedule|handover|night/.test(v) ? "Schedule and handovers"
    : /comment|discuss|note/.test(v) ? "Discussions" : /invite|joined/.test(v) ? "Invites" : /feeling|well/.test(v) ? "Wellbeing" : "Other";
  const features = Object.entries(activity.reduce<Record<string, number>>((acc, a) => { const f = feature(a.verb); acc[f] = (acc[f] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const fMax = Math.max(1, ...features.map(([, n]) => n));

  const newest = [...real].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
  const circlesOf = (id: string) => members.filter((m) => m.user_id === id).length;

  return (
    <main className="page ad" style={{ maxWidth: 1040 }}>
      <Link href="/" className="link">‹ Home</Link>
      <div><h1 style={{ marginBottom: 4 }}>Owner dashboard</h1>
        <p className="muted small" style={{ margin: 0 }}>Real accounts only; the demo families are left out. Counts and totals only: no family&apos;s own information is shown here.</p></div>

      <section className="stack"><h2>People</h2>
        <div className="ad-grid">
          <Stat n={real.length} label="accounts" sub={`${new7} new this week · ${new30} this month`} />
          <Stat n={active7} label="signed in this week" sub={`${active30} this month (${pct(active30, real.length)}%)`} />
          <Stat n={`${pct(inACircle.size, real.length)}%`} label="are in a family" sub={`${real.length - [...realIds].filter((id) => inACircle.has(id)).length} signed up but haven't joined one`} />
          <Stat n={wait.length} label="on the waiting list" sub={`${wait7} this week · ${converted} have since signed up`} />
        </div>
        <div className="card pad"><b>Sign-ups per week</b>
          <Bars labels={labels} series={[
            { name: "Waiting list", colour: "#A9D3C1", values: perWeek(wait.map((w) => w.created_at)) },
            { name: "New accounts", colour: "#2B6A55", values: perWeek(real.map((u) => u.created_at)) },
          ]} />
        </div>
      </section>

      <section className="stack"><h2>Families</h2>
        <div className="ad-grid">
          <Stat n={circles.length} label="families and Care Circles" sub={`${care} caring for someone · ${kids} with children`} />
          <Stat n={avgMembers} label="people per family, on average" />
          <Stat n={activeCircles7.size} label="active this week" sub={`${pct(activeCircles7.size, circles.length)}% of families`} />
          <Stat n={teamCircles} label="shared by 2+ people" sub="this month: the sign it's working" />
        </div>
        <div className="ad-two">
          <div className="card pad"><b>New families per week</b>
            <Bars labels={labels} series={[{ name: "New families", colour: "#684689", values: perWeek(circles.map((c) => c.created_at)) }]} />
          </div>
          <div className="card pad stack" style={{ gap: 8 }}><b>Who&apos;s in the families</b>
            {Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
              <div key={r} className="ad-row"><span>{{ admin: "Administrators", family: "Family members", contributor: "Contributors", helper: "Helpers", supported: "People being cared for / young people" }[r] || r}</span><b>{n}</b></div>
            ))}
            {!members.length && <p className="muted small" style={{ margin: 0 }}>No families yet.</p>}
          </div>
        </div>
      </section>

      <section className="stack"><h2>What people use (last 30 days)</h2>
        <div className="ad-grid">
          <Stat n={activity.length} label="things done in the app" />
          <Stat n={(tasksQ.data || []).filter((t) => circleIds.has(t.circle_id)).length} label="jobs added" />
          <Stat n={(apptsQ.data || []).filter((t) => circleIds.has(t.circle_id)).length} label="appointments added" />
          <Stat n={(lettersQ.data || []).filter((t) => circleIds.has(t.circle_id)).length + recs.length} label="letters read and appointments recorded" />
        </div>
        <div className="card pad stack" style={{ gap: 8 }}><b>Busiest features</b>
          {features.map(([f, n]) => (
            <div key={f} className="ad-hbar"><span>{f}</span><span className="ad-track"><span style={{ width: `${(n / fMax) * 100}%` }} /></span><b>{n}</b></div>
          ))}
          {!features.length && <p className="muted small" style={{ margin: 0 }}>Nothing yet.</p>}
        </div>
      </section>

      <section className="stack"><h2>Running costs (last 30 days, estimated)</h2>
        <div className="ad-grid">
          <Stat n={gbp(aiPence)} label="AI" sub={aiByKind.map(([k, n]) => `${AI_LABEL[k] || k} ${n}`).join(" · ") || "no use yet"} />
          <Stat n={gbp(textPence)} label={`texts (${texts} sent)`} sub="about 4p each" />
          <Stat n={emails} label="emails sent" sub="free on Resend up to 3,000 a month" />
          <Stat n={circles.length ? gbp((aiPence + textPence) / Math.max(1, circles.length)) : "£0.00"} label="per family" sub="AI and texts only" />
        </div>
        <p className="note">Estimates from usage counts, to watch the trend. Your OpenAI, Anthropic, Twilio and Vercel bills are the real figures.</p>
      </section>

      <section className="stack" id="helpful"><h2>Helpful things (last 30 days)</h2>
        <div className="ad-two">
          <div className="card pad stack" style={{ gap: 10 }}>
            <b>Suggestions are {helpfulIsOn ? "on" : "off"}</b>
            <p className="small muted" style={{ margin: 0 }}>Shown to parents and organisers only, never to children, helpers or the person being cared for. Anyone can hide them for themselves.</p>
            <p className="small" style={{ margin: 0 }}>{affiliateOn() ? "Your Amazon Associates tag is set, so links earn commission." : "No Amazon Associates tag yet: links work but don't earn. Add AMAZON_TAG in Vercel once Amazon approves you."}</p>
            <form action={setHelpful}><input type="hidden" name="on" value={helpfulIsOn ? "0" : "1"} />
              <button className={`btn ${helpfulIsOn ? "" : "primary"}`}>{helpfulIsOn ? "Switch suggestions off" : "Switch suggestions on"}</button></form>
          </div>
          <div className="card pad stack" style={{ gap: 8 }}><b>{clicks.length} clicks to Amazon</b>
            {clickItems.map(([i, n]) => <div key={i} className="ad-row"><span>{helpfulItem(i)?.item.name || i}</span><b>{n}</b></div>)}
            {clickPlaces.length > 0 && <p className="note" style={{ margin: 0 }}>Clicked from: {clickPlaces.map(([p, n]) => `${p} ${n}`).join(" · ")}</p>}
            {!clicks.length && <p className="muted small" style={{ margin: 0 }}>No clicks yet. Amazon&apos;s own reports show what was actually bought.</p>}
          </div>
        </div>
      </section>

      <section className="stack"><h2>Waiting list</h2>
        <div className="ad-two">
          <div className="card pad stack" style={{ gap: 8 }}><b>Who they are</b>
            {waitKinds.map(([k, n]) => <div key={k} className="ad-row"><span>{KIND_LABEL[k] || k}</span><b>{n}</b></div>)}
            {!wait.length && <p className="muted small" style={{ margin: 0 }}>Nobody yet.</p>}
          </div>
          <div className="card pad stack" style={{ gap: 8 }}><b>Where they came from</b>
            {waitSources.map(([s, n]) => <div key={s} className="ad-row"><span>{s}</span><b>{n}</b></div>)}
            <p className="note" style={{ margin: 0 }}>Share {site().replace(/^https?:\/\//, "")}/waitlist?from=instagram (or facebook, tiktok…) to see this.</p>
          </div>
        </div>
        <div className="card pad stack" style={{ gap: 8 }}><b>Kept in the loop (said yes to news and updates)</b>
          <div className="ad-row"><span>Accounts</span><b>{optQ.error ? "run update 0010" : optUsers}</b></div>
          <div className="ad-row"><span>Waiting list</span><b>{optWait}</b></div>
          <p className="note" style={{ margin: 0 }}>Only email news and offers to these people. Everyone on the waiting list can still hear when you launch.</p>
          <div className="row"><a href="/admin/marketing-export" className="btn">Download their emails (CSV)</a></div>
        </div>
        <div className="row"><Link href="/waitlist/admin" className="btn">Everyone on the waiting list</Link><a href="/waitlist/admin/export" className="btn">Download (CSV)</a></div>
      </section>

      <section className="stack"><h2>Newest accounts</h2>
        <div className="card list">
          {newest.map((u) => (
            <div key={u.id} className="item"><span className="main">
              <span className="t">{u.email}</span>
              <span className="s">Joined {short(u.created_at)} · last signed in {short(u.last_sign_in_at)} · {circlesOf(u.id) ? `in ${circlesOf(u.id)} ${circlesOf(u.id) === 1 ? "family" : "families"}` : "not in a family yet"}</span>
            </span></div>
          ))}
          {!newest.length && <p className="pad muted" style={{ margin: 0 }}>No accounts yet apart from the demo.</p>}
        </div>
      </section>
    </main>
  );
}
