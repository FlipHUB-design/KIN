import Link from "next/link";
import AuthShell from "../AuthShell";
import { requestReset } from "../actions";

export default async function Forgot({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Reset your password">
      {sp.sent ? (
        <p className="ok">If that email has a KIN account, we&apos;ve sent a link to reset the password. It expires in an hour.</p>
      ) : (
        <form action={requestReset} className="form">
          <label className="fl">Email<input name="email" type="email" autoComplete="email" required /></label>
          <button className="btn primary block">Send reset link</button>
        </form>
      )}
      <Link href="/login" className="small">Back to sign in</Link>
    </AuthShell>
  );
}
