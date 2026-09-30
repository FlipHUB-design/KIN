import Link from "next/link";
import Nav from "@/components/Nav";
import { getCircle } from "@/lib/data";

export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ circle: string }> }) {
  const { circle } = await params;
  const { role, user, me } = await getCircle(circle);
  const fullNav = role === "admin" || role === "family" || role === "contributor";
  const demo = user.email?.endsWith("@kin-demo.example.com");
  return (
    <>
      {demo && (
        <div style={{ background: "var(--ink)", color: "var(--bg)", fontSize: 14, padding: "8px 16px", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <span>Demo: you&apos;re {me.profiles?.display_name}. Everything here is made up.</span>
          <Link href="/demo" style={{ color: "inherit", fontWeight: 700 }}>Switch person</Link>
        </div>
      )}
      {children}
      {fullNav && <Nav base={`/c/${circle}`} />}
    </>
  );
}
