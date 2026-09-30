import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/(auth)/actions";

async function saveProfile(formData: FormData) {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  await supabase.from("profiles").update({
    display_name: String(formData.get("name")).trim(),
    phone: String(formData.get("phone")).trim() || null,
  }).eq("id", user.id);
  redirect("/account?notice=" + encodeURIComponent("Saved"));
}

async function deleteAccount(formData: FormData) {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (String(formData.get("confirm")).trim().toUpperCase() !== "DELETE") {
    redirect("/account?error=" + encodeURIComponent("Type DELETE to confirm."));
  }
  if (user.email?.endsWith("@kin-demo.example.com")) redirect("/account?error=" + encodeURIComponent("Demo accounts can't be deleted."));
  const admin = createAdminClient();
  if (!admin) redirect("/account?error=" + encodeURIComponent("Account deletion isn't set up on this server yet. Contact the KIN team."));
  // Circles where this user is the only administrator
  const { data: mine } = await supabase.from("memberships").select("circle_id, role").eq("user_id", user.id);
  for (const m of (mine || []).filter((x) => x.role === "admin")) {
    const { data: all } = await admin.from("memberships").select("user_id, role").eq("circle_id", m.circle_id);
    const others = (all || []).filter((x) => x.user_id !== user.id);
    if (others.length === 0) {
      const { data: files } = await admin.storage.from("documents").list(m.circle_id);
      if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${m.circle_id}/${f.name}`));
      await admin.from("care_circles").delete().eq("id", m.circle_id);
    } else if (!others.some((x) => x.role === "admin")) {
      redirect("/account?error=" + encodeURIComponent("You're the only administrator of a Care Circle that has other members. Make someone else an administrator first."));
    }
  }
  await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (
    <main className="page">
      <Link href="/circles" className="link">‹ People I help</Link>
      <h1>Your account</h1>
      {sp.notice && <p className="ok">{sp.notice}</p>}
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={saveProfile} className="card pad form">
        <label className="fl">Your name<input name="name" defaultValue={me?.display_name || ""} required /></label>
        <label className="fl">Phone<input name="phone" type="tel" defaultValue={me?.phone || ""} />
          <span className="note">Shown to people in your Care Circles so they can reach you.</span></label>
        <p className="small muted">Signed in as {user.email}</p>
        <button className="btn primary">Save</button>
      </form>
      <div className="card pad">
        <h2>Your data</h2>
        <p className="small">Download everything you can see in KIN as a file.</p>
        <a href="/account/export" className="btn">Download my data</a>
        <Link href="/account/password" className="btn">Change password</Link>
        <form action={signOut}><button className="btn block">Sign out</button></form>
      </div>
      <form action={deleteAccount} className="card pad form">
        <h2>Delete your account</h2>
        <p className="small">This removes you from every Care Circle. Circles where you&apos;re the only member are deleted with their documents. Tasks and notes you added stay for the family, without your name.</p>
        <label className="fl">Type DELETE to confirm<input name="confirm" autoComplete="off" /></label>
        <button className="btn warn">Delete my account</button>
      </form>
    </main>
  );
}
