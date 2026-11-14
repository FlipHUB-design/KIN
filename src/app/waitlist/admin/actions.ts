"use server";
import { redirect } from "next/navigation";
import { ownerOnly } from "@/lib/owner";
import { emailOn, sendEmailDetailed, site } from "@/lib/notify";
import { waitlistWelcome } from "@/lib/welcome";

const back = (q: string) => redirect(`/waitlist/admin?${q}`);

/** Sends the welcome email to the owner, to check email is working and see how it looks. */
export async function sendTestWelcome() {
  const { ok, user } = await ownerOnly();
  if (!ok || !user?.email) back("error=" + encodeURIComponent("Only the owner can do this."));
  if (!emailOn()) back("error=" + encodeURIComponent("Email isn't set up: add RESEND_API_KEY in Vercel."));
  const w = waitlistWelcome(null, "both", site());
  const r = await sendEmailDetailed(user!.email!, `[Test] ${w.subject}`, w.html, w.text);
  back(r.ok ? "notice=" + encodeURIComponent(`Test welcome email sent to ${user!.email}. Check your inbox (and spam).`) : "error=" + encodeURIComponent(r.error || "It didn't send."));
}

/** Sends (or re-sends) the welcome email to everyone on the list, or one person. */
export async function resendWelcome(f: FormData) {
  const { ok, admin } = await ownerOnly();
  if (!ok || !admin) back("error=" + encodeURIComponent("Only the owner can do this."));
  const id = String(f.get("id") || "");
  const q = admin!.from("waitlist").select("email, name, kind");
  const { data } = id ? await q.eq("id", id) : await q;
  let sent = 0; let lastError = "";
  for (const row of data || []) {
    const w = waitlistWelcome(row.name, row.kind, site());
    const r = await sendEmailDetailed(row.email, w.subject, w.html, w.text);
    if (r.ok) sent++; else { lastError = r.error || ""; break; }
  }
  back(lastError ? "error=" + encodeURIComponent(`${sent ? `Sent ${sent}, then stopped. ` : ""}${lastError}`) : "notice=" + encodeURIComponent(`Welcome email sent to ${sent} ${sent === 1 ? "person" : "people"}.`));
}
