import Link from "next/link";
import AuthShell from "../AuthShell";
import { signIn } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const next = sp.next || "/circles";
  return (
    <AuthShell title="Sign in">
      {sp.error && <p className="error">{sp.error}</p>}
      {sp.notice && <p className="ok">{sp.notice}</p>}
      <form action={signIn} className="form">
        <input type="hidden" name="next" value={next} />
        <label className="fl">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="fl">Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn primary block">Sign in</button>
      </form>
      <div className="row between small">
        <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
        <Link href="/forgot">Forgotten your password?</Link>
      </div>
    </AuthShell>
  );
}
