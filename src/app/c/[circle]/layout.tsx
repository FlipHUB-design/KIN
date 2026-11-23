import Link from "next/link";
import Nav from "@/components/Nav";
import { getCircle, getUser } from "@/lib/data";

export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ circle: string }> }) {
  const { circle } = await params;
  const { supabase, user } = await getUser();
  // The alert count and the circle load at the same time rather than one after the other
  const [{ role, me, circle: c }, { count: unread }] = await Promise.all([
    getCircle(circle),
    user ? supabase.from("notifications").select("id", { count: "exact", head: true }).eq("circle_id", circle).eq("user_id", user.id).is("read_at", null) : Promise.resolve({ count: 0 }),
  ]);
  const fullNav = role === "admin" || role === "family" || role === "contributor";
  const showHelp = !(role === "supported" && c.kind === "care");
  const demo = user?.email?.endsWith("@kin-demo.example.com");
  return (
    <>
      {demo && (
        <div style={{ background: "var(--ink)", color: "var(--bg)", fontSize: 14, padding: "8px 16px", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <span>Demo: you&apos;re {me.profiles?.display_name}. Everything here is made up.</span>
          <Link href="/demo" style={{ color: "inherit", fontWeight: 700 }}>Switch person</Link>
        </div>
      )}
      {!!unread && (
        <Link href={`/c/${circle}/alerts`} className="alertbar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          {unread === 1 ? "1 new alert" : `${unread} new alerts`} ›
        </Link>
      )}
      {children}
      {showHelp && <Link href={`/ask?c=${circle}`} className={`helpfab${fullNav ? "" : " nonav"}`} aria-label="Ask Many Hands: help with using the app" title="Ask Many Hands">?</Link>}
      {fullNav && <Nav base={`/c/${circle}`} />}
    </>
  );
}
