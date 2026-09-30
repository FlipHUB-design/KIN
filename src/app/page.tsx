import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";

export default async function Landing() {
  const { user } = await getUser();
  if (user) redirect("/circles");
  return (
    <main className="page" style={{ paddingBottom: 48, gap: 28 }}>
      <span className="brand">KIN</span>
      <section className="stack" style={{ gap: 14 }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.15 }}>Know what&apos;s happening. Know what needs doing. Know who&apos;s doing it.</h1>
        <p className="muted" style={{ fontSize: 18 }}>
          KIN helps families share the practical side of supporting a parent or relative: visits, lifts to appointments,
          shopping, household jobs, important contacts and documents, all in one calm place.
        </p>
        <div className="row">
          <Link href="/signup" className="btn primary">Start a Care Circle</Link>
          <Link href="/login" className="btn">Sign in</Link>
        </div>
        <Link href="/demo" className="link">Try the demo with an example family ›</Link>
      </section>
      <section className="card pad">
        <h2>How it works</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Create a Care Circle around the person you help.</li>
          <li>Invite family, and give neighbours or a cleaner limited access.</li>
          <li>Add appointments and regular jobs. Anyone can say &ldquo;I&apos;ll do it&rdquo;.</li>
          <li>Check in when you visit, so everyone can see what&apos;s happened.</li>
        </ol>
      </section>
      <p className="disclaimer">
        KIN is a family coordination tool. It isn&apos;t a medical service and doesn&apos;t monitor anyone&apos;s health.
        In an emergency call 999. For urgent medical advice call NHS 111.
      </p>
    </main>
  );
}
