"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, emailOn, sendEmail, site } from "@/lib/notify";

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
  const { error } = await admin!.from("waitlist").insert({ email, name, kind, note, source });
  if (error?.code === "23505") back("joined=1&already=1");
  if (error) {
    console.error("waitlist insert failed", error.message);
    back("error=" + encodeURIComponent("Sorry, something went wrong. Please try again."));
  }

  if (emailOn()) {
    const first = name?.split(" ")[0];
    const lines = [
      `${first ? `Thanks, ${first}` : "Thanks"}. You're on the Many Hands waiting list.`,
      "Many Hands keeps everyone who helps a family in one place: the calendar, who's doing what, appointments, costs and the children's two-home schedule.",
      "We'll email you when we open to our first families. Nothing else, and you can ask us to remove you at any time by replying to this email.",
    ];
    await sendEmail(email, "You're on the Many Hands waiting list",
      emailHtml({ heading: "You're on the list", lines, button: { label: "Try the demo", href: `${site()}/demo` }, footer: "Many hands make light work." }),
      lines.join("\n\n") + `\n\nTry the demo: ${site()}/demo`);
  }
  back("joined=1");
}
