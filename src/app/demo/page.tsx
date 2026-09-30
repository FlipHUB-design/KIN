import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_ENABLED, PERSONAS, PICKABLE, ensureDemo } from "@/lib/demo";

async function reset() {
  "use server";
  const admin = createAdminClient();
  if (!admin || !DEMO_ENABLED) redirect("/demo");
  try { await ensureDemo(admin, true); } catch { redirect("/demo?error=" + encodeURIComponent("Reset failed. Please try again.")); }
  redirect("/demo?notice=" + encodeURIComponent("Demo data reset"));
}

export default async function Demo({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!DEMO_ENABLED) return <main className="page"><Link href="/" className="brand">KIN</Link><h1>The demo is switched off</h1></main>;
  return (
    <main className="page" style={{ paddingBottom: 48 }}>
      <Link href="/" className="brand">KIN</Link>
      <h1>Try KIN with the Hale family</h1>
      <p className="muted">Margaret is 78 and lives on her own. Her daughter Sarah organises things, her sons and granddaughter help, and a cleaner and neighbour pop in. Pick who you&apos;d like to be. Each person sees only what their role allows.</p>
      {sp.error && <p className="error">{sp.error}</p>}
      {sp.notice && <p className="ok">{sp.notice}</p>}
      <div className="card list">
        {PICKABLE.map((p) => (
          <a key={p} href={`/demo/${p}`} className="item">
            <span className="avatar">{PERSONAS[p].name[0]}</span>
            <span className="main"><span className="t">{PERSONAS[p].name} <span className="muted">· {PERSONAS[p].role}</span></span><span className="s">{PERSONAS[p].blurb}</span></span>
            <span className="muted">›</span>
          </a>
        ))}
      </div>
      <p className="note">Everyone here is made up, and the demo is shared with other visitors. Don&apos;t enter real personal information. The example data resets every day. Opening the demo signs you out of any real KIN account in this browser.</p>
      <form action={reset}><button className="link">Reset the demo data now</button></form>
    </main>
  );
}
