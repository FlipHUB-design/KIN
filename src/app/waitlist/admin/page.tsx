import Link from "next/link";
import { redirect } from "next/navigation";
import { KIND_LABEL, ownerOnly, type WaitRow } from "@/lib/owner";
import { site } from "@/lib/notify";
import CopyLink from "../CopyLink";

export const dynamic = "force-dynamic";
const day = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

/** The owner's view of who has joined the waiting list. */
export default async function WaitlistAdmin() {
  const { user, ok, configured, admin } = await ownerOnly();
  if (!user) redirect("/login?next=/waitlist/admin");
  if (!ok) return (
    <main className="page"><h1>Waiting list</h1>
      <p className="muted">{configured ? "This page is only for the Many Hands team." : "Add ADMIN_EMAILS (your email address) in Vercel's environment variables, then redeploy, to see sign-ups here."}</p>
      <Link href="/" className="link">‹ Home</Link></main>
  );
  const { data, error } = admin ? await admin.from("waitlist").select("*").order("created_at", { ascending: false }).limit(5000) : { data: null, error: { message: "no server key" } };
  const rows = (data || []) as WaitRow[];
  const count = (f: (r: WaitRow) => boolean) => rows.filter(f).length;
  const week = Date.now() - 7 * 86400000;
  const sources = Object.entries(rows.reduce<Record<string, number>>((a, r) => { const k = r.source || "direct"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <Link href="/" className="link">‹ Home</Link>
      <h1>Waiting list</h1>
      {error && <p className="error">Couldn&apos;t load the list. Has the waiting list database update (0008) been run?</p>}
      <div className="wl-stats">
        <div className="card pad"><b>{rows.length}</b><span>signed up</span></div>
        <div className="card pad"><b>{count((r) => Date.parse(r.created_at) > week)}</b><span>this week</span></div>
        <div className="card pad"><b>{count((r) => r.kind === "coparent" || r.kind === "both")}</b><span>co-parents</span></div>
        <div className="card pad"><b>{count((r) => r.kind === "carer" || r.kind === "both")}</b><span>caring for someone older</span></div>
      </div>
      <div className="card pad stack" style={{ gap: 8 }}>
        <b>Links to share</b>
        <p className="small muted" style={{ margin: 0 }}>Add <code>?from=</code> so you can see which social media brings people in.</p>
        {["instagram", "facebook", "tiktok", "linkedin"].map((s) => <CopyLink key={s} url={`${site()}/waitlist?from=${s}`} />)}
        {sources.length > 0 && <p className="small" style={{ margin: 0 }}>Where people came from: {sources.map(([s, n]) => `${s} ${n}`).join(" · ")}</p>}
      </div>
      <div className="row"><a href="/waitlist/admin/export" className="btn">Download as a spreadsheet (CSV)</a></div>
      <div className="card list">
        {rows.map((r) => (
          <div key={r.id} className="item"><span className="main">
            <span className="t">{r.name ? `${r.name} · ` : ""}{r.email}</span>
            <span className="s">{KIND_LABEL[r.kind] || r.kind} · {day(r.created_at)}{r.source ? ` · from ${r.source}` : ""}</span>
            {r.note && <span className="s" style={{ fontStyle: "italic" }}>&ldquo;{r.note}&rdquo;</span>}
          </span></div>
        ))}
        {!rows.length && !error && <p className="pad muted" style={{ margin: 0 }}>Nobody yet. Share your link to get the first sign-ups.</p>}
      </div>
    </main>
  );
}
