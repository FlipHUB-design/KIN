import Link from "next/link";
import AuthShell from "../AuthShell";
import { signUp } from "../actions";

export default async function Signup({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const next = sp.next || "/circles";
  return (
    <AuthShell title="Create your account">
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={signUp} className="form">
        <input type="hidden" name="next" value={next} />
        <label className="fl">Your name<input name="name" autoComplete="name" required /></label>
        <label className="fl">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="fl">Password<input name="password" type="password" autoComplete="new-password" minLength={10} required />
          <span className="note">At least 10 characters.</span></label>
        <button className="btn primary block">Create account</button>
      </form>
      <p className="note">By creating an account you agree to how KIN handles your family&apos;s information, described in our <Link href="/privacy">privacy notice</Link>.</p>
      <p className="small">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </AuthShell>
  );
}
