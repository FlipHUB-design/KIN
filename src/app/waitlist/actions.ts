"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailOn, sendEmailDetailed, site } from "@/lib/notify";
import { waitlistWelcome } from "@/lib/welcome";

const KINDS = ["coparent", "carer", "both", "other"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const back = (q: string) => redirect(`/waitlist?${q}#join`);

/** Adds someone to the pre-launch waiting list. */
export async function joinWaitlist(f: FormData) {
  if (String(f.get("website") || "")) back("joined=1"); // a bot filled the hidden field: pretend it worked
  const email = String(f.get("email") || "").trim().toLowerCase().slice(0, 254);
  const name = String(f.get("name") || "").trim().slice(0, 80) || null;
  const kindIn = String(f.get("kind") || "other");
  const kind = (KINDS as readonly string[]).includes(kindIn) ? kindIn : "other";
  const note = String(f.get("note") || "").trim().slice(0, 500) || null;
  const source = String(f.get("source") || "").replace(/[^a-z0-9_.-]/gi, "").toLowerCase().slice(0, 60) || null;
  if (!EMAIL.test(email)) back("error=" + encodeURIComponent("Please check your email address."));

  const admin = createAdminClient();
  if (!admin) back("error=" + encodeURIComponent("Sorry, the waiting list isn't open yet. Please try again soon."));
  const marketing = f.get("marketing") === "1";
  const row = { email, name, kind, note, source, ...(marketing ? { marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() } : {}) };
  let { error } = await admin!.from("waitlist").insert(row);
  // Before the consent update (0010) is run the columns don't exist: save the sign-up anyway
  if (error && marketing && /marketing_opt_in/.test(error.message)) ({ error } = await admin!.from("waitlist").insert({ email, name, kind, note, source }));
  if (error?.code === "23505" && marketing) await admin!.from("waitlist").update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() }).ilike("email", email);
  if (error?.code === "23505") back("joined=1&already=1");
  if (error) {
    console.error("waitlist insert failed", error.message);
    back("error=" + encodeURIComponent("Sorry, something went wrong. Please try again."));
  }

  if (emailOn()) {
    const w = waitlistWelcome(name, kind, site());
    const sent = await sendEmailDetailed(email, w.subject, w.html, w.text);
    if (!sent.ok) console.error("waitlist welcome email not sent:", sent.error);
  }
  back("joined=1");
}
