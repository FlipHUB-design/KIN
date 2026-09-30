import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function setPassword(formData: FormData) {
  "use server";
  const pw = String(formData.get("password"));
  if (pw.length < 10) redirect("/account/password?error=" + encodeURIComponent("Use at least 10 characters."));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) redirect("/account/password?error=" + encodeURIComponent(error.message));
  redirect("/account?notice=" + encodeURIComponent("Password updated"));
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <span className="brand">KIN</span>
      <h1>Choose a new password</h1>
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={setPassword} className="form">
        <label className="fl">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
        <button className="btn primary block">Save password</button>
      </form>
    </main>
  );
}
