import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import Wordmark from "@/components/Wordmark";

export default async function Landing() {
  const { user } = await getUser();
  if (user) redirect("/circles");
  return (
    <main className="page" style={{ paddingBottom: 48, gap: 28 }}>
      <span className="brand"><Wordmark /></span>
      <section className="stack" style={{ gap: 14 }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.15 }}>Know what&apos;s happening. Know what needs doing. Know who&apos;s doing it.</h1>
        <p className="muted" style={{ fontSize: 18 }}>
          KIN is the shared admin app for families. Bring up children across one home or two, or support an older parent,
          with the schedule, school letters, pick-ups, costs and paperwork in one calm place.
        </p>
        <div className="row">
          <Link href="/signup" className="btn primary">Get started</Link>
          <Link href="/login" className="btn">Sign in</Link>
        </div>
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
        KIN is a family coordination tool. It isn&apos;t a medical service or legal advice.
        In an emergency call 999. For urgent medical advice call NHS 111.
      </p>
    </main>
  );
}
