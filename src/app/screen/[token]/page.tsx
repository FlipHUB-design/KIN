import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import KidWeek from "@/components/KidWeek";
import Wordmark from "@/components/Wordmark";
import { kidWeek } from "@/lib/kidweek";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My week", robots: { index: false, follow: false } };

/** A no-sign-in week view for one child, for a tablet at home. Parents can switch the link off. */
export default async function Screen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const sc = admin && /^[0-9a-f]{32,80}$/.test(token)
    ? (await admin.from("child_screens").select("circle_id, child_id, revoked").eq("token", token).maybeSingle()).data : null;
  const child = sc && !sc.revoked ? (await admin!.from("children").select("first_name").eq("id", sc.child_id).maybeSingle()).data : null;
  if (!admin || !sc || sc.revoked || !child) return <main className="page"><h1>This link isn&apos;t working</h1><p className="muted">Ask a grown-up to make a new one in KIN.</p></main>;
  const days = await kidWeek(admin, sc.circle_id, sc.child_id, 7);
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <meta httpEquiv="refresh" content="1800" />
      <span className="brand"><Wordmark /></span>
      <h1 style={{ fontSize: 40 }}>Hi {child.first_name}!</h1>
      <KidWeek name={child.first_name} days={days} />
    </main>
  );
}
