import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_ENABLED, KIDS_PICKABLE, PERSONAS, PICKABLE, ensureDemo, type Persona } from "@/lib/demo";
import Wordmark from "@/components/Wordmark";

async function reset() {
  "use server";
  const admin = createAdminClient();
  if (!admin || !DEMO_ENABLED) redirect("/demo");
  try { await ensureDemo(admin, true); } catch (e) { console.error(e); redirect("/demo?error=" + encodeURIComponent("Reset failed. Please try again.")); }
  redirect("/demo?notice=" + encodeURIComponent("Demo data reset"));
}

function People({ list }: { list: Persona[] }) {
  return (
    <div className="card list">
      {list.map((p) => (
        <a key={p} href={`/demo/${p}`} className="item">
          <span className="avatar">{PERSONAS[p].name[0]}</span>
          <span className="main"><span className="t">{PERSONAS[p].name} <span className="muted">· {PERSONAS[p].role}</span></span><span className="s">{PERSONAS[p].blurb}</span></span>
          <span className="muted">›</span>
        </a>
      ))}
    </div>
  );
}

export default async function Demo({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!DEMO_ENABLED) return <main className="page"><Link href="/" className="brand"><Wordmark /></Link><h1>The demo is switched off</h1></main>;
  return (
    <main className="page" style={{ paddingBottom: 48 }}>
      <Link href="/" className="brand"><Wordmark /></Link>
      <h1>Try KIN</h1>
      <p className="muted">Two made-up families. Pick who you&apos;d like to be. Each person sees only what their role allows.</p>
      {sp.error && <p className="error">{sp.error}</p>}
      {sp.notice && <p className="ok">{sp.notice}</p>}
      <section className="stack">
        <h2>The Carter family: children across two homes</h2>
        <p className="small muted">Leah and Dan are separated and share Ruby (13) and Alfie (8) on a 2-2-5-5 pattern. Grandma Jean does Wednesday tea, and Kelly the childminder does Monday and Tuesday pick-ups.</p>
        <People list={KIDS_PICKABLE} />
      </section>
      <section className="stack">
        <h2>The Hale family: caring for Margaret</h2>
        <p className="small muted">Margaret is 78 and lives on her own. Her daughter Sarah organises things, her sons and granddaughter help, and a cleaner and neighbour pop in.</p>
        <People list={PICKABLE} />
      </section>
      <p className="note">Everyone here is made up, and the demo is shared with other visitors. Don&apos;t enter real personal information. The example data resets every day. Opening the demo signs you out of any real KIN account in this browser.</p>
      <form action={reset}><button className="link">Reset the demo data now</button></form>
    </main>
  );
}
