import Link from "next/link";
import { getUser } from "@/lib/data";
import Wordmark from "@/components/Wordmark";

export default async function Landing() {
  const { user } = await getUser();
  const demo = !!user?.email?.endsWith("@kin-demo.example.com");
  return (
    <main className="page" style={{ paddingBottom: 48, gap: 28 }}>
      <span className="brand" style={{ fontSize: 30 }}><Wordmark /></span>
      <section className="stack" style={{ gap: 14 }}>
        <h1 style={{ fontSize: 42, lineHeight: 1.08 }}>Many hands make light work.</h1>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", margin: 0, fontFamily: "var(--font-display), sans-serif" }}>Keeping families connected. Making care simple.</p>
        <p className="muted" style={{ fontSize: 18 }}>
          Many Hands is the shared admin app for families. Bring up children across one home or two, or support an older parent,
          with the schedule, school letters, pick-ups, costs and paperwork in one calm place.
        </p>
        {user ? (
          <div className="row">
            <Link href={demo ? "/demo" : "/circles"} className="btn primary">{demo ? "Back to the demo" : "Open Many Hands"}</Link>
          </div>
        ) : (
          <div className="row">
            <Link href="/signup" className="btn primary">Get started</Link>
            <Link href="/login" className="btn">Sign in</Link>
          </div>
        )}
        <Link href="/demo" className="link">Try the demo with two example families ›</Link>
      </section>
      <section className="card pad">
        <h2>How it works</h2>
        <div className="two">
          <div className="stack" style={{ gap: 6 }}><b>For children</b>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Who has the children tonight, and swap requests the other parent can agree</li>
              <li>Handover packing lists and &ldquo;where is it?&rdquo;</li>
              <li>School letters turned into tasks</li>
              <li>Shared costs with approvals, and a maintenance record</li>
              <li>Simple views for grandparents, childminders and teenagers</li>
            </ul></div>
          <div className="stack" style={{ gap: 6 }}><b>For an older parent</b>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Visits, lifts and check-ins</li>
              <li>Council and DWP letters turned into tasks</li>
              <li>Attendance Allowance and other UK playbooks</li>
              <li>Shared costs between siblings</li>
              <li>A simple large-text view for them</li>
            </ul></div>
        </div>
      </section>
      <p className="disclaimer">
        Many Hands is a family coordination tool. It isn&apos;t a medical service or legal advice.
        In an emergency call 999. For urgent medical advice call NHS 111.
      </p>
    </main>
  );
}
