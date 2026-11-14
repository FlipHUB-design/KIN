import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import CopyLink from "./CopyLink";
import { joinWaitlist } from "./actions";
import { site } from "@/lib/notify";

export const metadata: Metadata = {
  title: "Join the Many Hands waiting list",
  description: "Many hands make light work. The shared family app for co-parents and families looking after someone older. Be one of our first families.",
  openGraph: {
    title: "Join the Many Hands waiting list",
    description: "Many hands make light work. Keeping families connected. Making care simple.",
    images: [{ url: "/og-waitlist.png", width: 1200, height: 630, alt: "Many Hands: many hands make light work" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og-waitlist.png"] },
};

const KINDS = [
  ["coparent", "I'm a parent sharing children across two homes"],
  ["carer", "I help look after someone older"],
  ["both", "Both of these"],
  ["other", "Just interested"],
] as const;

export default async function Waitlist({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const source = (sp.from || sp.utm_source || sp.ref || "").replace(/[^a-z0-9_.-]/gi, "").slice(0, 60);
  const joined = sp.joined === "1";
  return (
    <main className="page wl" style={{ paddingBottom: 56, gap: 28 }}>
      <Link href="/" className="brand" style={{ fontSize: 30 }} aria-label="Many Hands home"><Wordmark /></Link>

      <section className="stack" style={{ gap: 14 }}>
        <p className="label" style={{ color: "var(--accent)" }}>Coming soon</p>
        <h1 style={{ fontSize: 42, lineHeight: 1.08 }}>Many hands make light work.</h1>
        <p style={{ fontSize: 21, fontWeight: 700, color: "var(--accent)", margin: 0, fontFamily: "var(--font-display), sans-serif" }}>Keeping families connected. Making care simple.</p>
        <p className="muted" style={{ fontSize: 18, margin: 0 }}>
          Many Hands is one shared place for everyone who helps your family: the calendar, who&apos;s doing what, appointments, costs,
          and where the children are sleeping tonight. Join the waiting list to be one of our first families.
        </p>
      </section>

      <ul className="wl-points">
        <li><b>For co-parents:</b> one schedule across two homes, swaps agreed in writing, shared costs without the awkward chats.</li>
        <li><b>For families caring for someone older:</b> lifts, visits and appointments shared out, with the questions to ask and what the doctor said.</li>
        <li><b>Private by design:</b> the neighbour, the childminder and the grandchildren each see only what they need.</li>
      </ul>

      <section id="join" className="card pad">
        {joined ? (
          <div className="stack" style={{ gap: 12 }} role="status">
            <h2 style={{ margin: 0 }}>{sp.already ? "You're already on the list" : "You're on the list!"}</h2>
            <p style={{ margin: 0 }}>Thank you. We&apos;ll email you when Many Hands opens to our first families{sp.already ? "" : ", and we've sent you a quick confirmation"}.</p>
            <p style={{ margin: 0 }}>Know a family who&apos;d find this useful? Share the link with them.</p>
            <CopyLink url={`${site()}/waitlist`} />
            <Link href="/demo" className="link">Have a look round the demo while you wait ›</Link>
          </div>
        ) : (
          <form action={joinWaitlist} className="form">
            <h2 style={{ margin: 0 }}>Join the waiting list</h2>
            {sp.error && <p className="error" role="alert">{sp.error}</p>}
            <input type="hidden" name="source" value={source} />
            <div className="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <label className="fl">Your first name <span className="muted">(optional)</span><input name="name" maxLength={80} autoComplete="given-name" /></label>
            <label className="fl">Email address<input name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" /></label>
            <fieldset className="wl-kinds">
              <legend>Which describes you best?</legend>
              {KINDS.map(([v, l], i) => (
                <label key={v}><input type="radio" name="kind" value={v} defaultChecked={i === 3} /><span>{l}</span></label>
              ))}
            </fieldset>
            <label className="fl">What would make life easier for your family? <span className="muted">(optional)</span>
              <textarea name="note" rows={3} maxLength={500} placeholder="e.g. Knowing who's taking Mum to her appointments" />
            </label>
            <button className="btn primary block" style={{ minHeight: 52, fontSize: 18 }}>Join the waiting list</button>
            <p className="note" style={{ margin: 0 }}>We&apos;ll only email you about Many Hands launching, and you can ask to be removed at any time. See our <Link href="/privacy" className="link">privacy notice</Link>.</p>
          </form>
        )}
      </section>

      <p className="note" style={{ textAlign: "center" }}>Can&apos;t wait? <Link href="/demo" className="link">Try the demo with two example families</Link>.</p>
    </main>
  );
}
