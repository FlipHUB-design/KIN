"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const safeNext = (n: FormDataEntryValue | null) => {
  const s = String(n || "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/circles";
};

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")).trim(),
    password: String(formData.get("password")),
  });
  if (error) redirect(`/login?error=${encodeURIComponent("That email and password don't match. Try again or reset your password.")}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const name = String(formData.get("name")).trim();
  const password = String(formData.get("password"));
  if (password.length < 10) redirect(`/signup?error=${encodeURIComponent("Use at least 10 characters for your password.")}&next=${encodeURIComponent(next)}`);
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")).trim(),
    password,
    options: { data: { display_name: name }, emailRedirectTo: `${site()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  if (data.session) redirect(next);
  redirect(`/login?notice=${encodeURIComponent("Check your email for a link to confirm your account, then sign in.")}&next=${encodeURIComponent(next)}`);
}

export async function requestReset(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(String(formData.get("email")).trim(), {
    redirectTo: `${site()}/auth/callback?next=/account/password`,
  });
  redirect(`/forgot?sent=1`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
