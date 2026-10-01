import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email and text alerts.
 * - Email goes through Resend (RESEND_API_KEY, KIN_EMAIL_FROM).
 * - Texts go through Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID).
 * Every alert is also saved in KIN, so it shows on the person's Alerts page even
 * when email or text isn't set up. Demo accounts never send anything outside KIN.
 */

export type Level = "answer" | "update" | "urgent";
export type Channels = Record<Level, { email: boolean; sms: boolean }>;
export const DEFAULT_CHANNELS: Channels = {
  answer: { email: true, sms: false },
  update: { email: true, sms: false },
  urgent: { email: true, sms: true },
};
export const LEVEL_LABEL: Record<Level, string> = {
  answer: "Needs your answer",
  update: "News for you",
  urgent: "Urgent",
};
export const LEVEL_DESC: Record<Level, string> = {
  answer: "Schedule change requests, costs to approve, proposed agreements, questions from the children",
  update: "Answers to your requests, jobs given to you, comments, handovers with missing items",
  urgent: "Someone pressed “I need help”",
};

export const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://kin-six-brown.vercel.app").replace(/\/$/, "");
export const emailOn = () => !!process.env.RESEND_API_KEY;
export const smsOn = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
export const isDemoEmail = (e?: string | null) => !!e?.endsWith("@kin-demo.example.com");

/** Turns a UK or international number into +44... form, or null if it doesn't look like a mobile. */
export function mobileNumber(raw?: string | null) {
  if (!raw) return null;
  let p = raw.replace(/[\s()-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^07\d{9}$/.test(p)) p = "+44" + p.slice(1);
  if (/^447\d{9}$/.test(p)) p = "+" + p;
  if (p.startsWith("+44")) return /^\+447\d{9}$/.test(p) ? p : null;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

function londonMinutes(d = new Date()) {
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return (h % 24) * 60 + m;
}
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
export function inQuietHours(start: string, end: string, d = new Date()) {
  const now = londonMinutes(d), s = mins(start), e = mins(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailHtml(opts: { heading: string; lines: string[]; button?: { label: string; href: string }; footer: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="font-weight:700;letter-spacing:.08em;font-size:13px;color:#6b6259;margin-bottom:12px">KIN</div>
<div style="background:#fff;border-radius:14px;padding:22px 20px;border:1px solid #e8e1d6">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px">${esc(opts.heading)}</h1>
${opts.lines.filter(Boolean).map((l) => `<p style="font-size:16px;line-height:1.5;margin:0 0 10px">${esc(l)}</p>`).join("")}
${opts.button ? `<p style="margin:18px 0 4px"><a href="${esc(opts.button.href)}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">${esc(opts.button.label)}</a></p>` : ""}
</div>
<p style="font-size:13px;line-height:1.5;color:#6b6259;margin:14px 4px">${esc(opts.footer)}</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.KIN_EMAIL_FROM || "KIN <onboarding@resend.dev>", to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Email failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) { console.error("Email failed", e); return false; }
}

export async function sendText(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return false;
  const form = new URLSearchParams({ To: to, Body: body.slice(0, 320) });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Text failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) { console.error("Text failed", e); return false; }
}

export type Alert = {
  circleId: string;
  circleName: string;      // e.g. "The Carter family" or "Mum's Care Circle"
  to: (string | null | undefined)[];
  actor: string;           // never alert the person who did the thing
  level: Level;
  title: string;           // one line, e.g. "Dan asked to change the schedule"
  body?: string | null;    // a sentence or two of detail
  path: string;            // where in the circle to open, e.g. "/schedule"
};

/** Saves the alert for each recipient and sends it by the channels they chose. Never throws. */
export async function notify(a: Alert) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const wanted = [...new Set(a.to.filter((x): x is string => !!x && x !== a.actor))];
    if (!wanted.length) return;
    // Only current, active members of this circle
    const { data: members } = await admin.from("memberships").select("user_id, profiles(phone)").eq("circle_id", a.circleId).eq("status", "active").in("user_id", wanted);
    if (!members?.length) return;
    const ids = members.map((m) => m.user_id as string);
    const { data: prefs } = await admin.from("notification_prefs").select("*").in("user_id", ids);
    const link = `${site()}/c/${a.circleId}${a.path}`;
    const rows = await Promise.all(members.map(async (m) => {
      const id = m.user_id as string;
      const p = prefs?.find((x) => x.user_id === id);
      const ch: Channels = { ...DEFAULT_CHANNELS, ...(p?.channels || {}) };
      const want = ch[a.level] || DEFAULT_CHANNELS[a.level];
      const { data: u } = await admin.auth.admin.getUserById(id);
      const email = u.user?.email;
      const demo = isDemoEmail(email);
      const phone = mobileNumber((m.profiles as { phone?: string | null } | null)?.phone);

      let email_status = "off";
      if (want.email) {
        if (demo) email_status = "demo";
        else if (!emailOn()) email_status = "not_setup";
        else if (email) email_status = (await sendEmail(email, a.title,
          emailHtml({ heading: a.title, lines: [a.body || ""], button: { label: a.level === "answer" ? "Open KIN to answer" : "Open KIN", href: link },
            footer: `You're getting this because you're in ${a.circleName} on KIN. Change which alerts you get at ${site()}/account/alerts` }),
          `${a.title}\n\n${a.body ? a.body + "\n\n" : ""}${link}\n\nChange which alerts you get: ${site()}/account/alerts`)) ? "sent" : "failed";
      }

      let sms_status = "off";
      if (want.sms) {
        if (!phone) sms_status = "no_number";
        else if (a.level !== "urgent" && inQuietHours(String(p?.quiet_start || "21:00"), String(p?.quiet_end || "07:00"))) sms_status = "quiet";
        else if (demo) sms_status = "demo";
        else if (!smsOn()) sms_status = "not_setup";
        else sms_status = (await sendText(phone, `KIN: ${a.title}. ${link}`)) ? "sent" : "failed";
      }
      return { circle_id: a.circleId, user_id: id, level: a.level, title: a.title.slice(0, 200), body: a.body?.slice(0, 500) || null, link: a.path, email_status, sms_status };
    }));
    await admin.from("notifications").insert(rows);
  } catch (e) {
    console.error("Alert failed", e);
  }
}

/** Short, human status for the Alerts page. */
export function deliveryText(email: string | null, sms: string | null) {
  const part = (s: string | null, what: string) => {
    switch (s) {
      case "sent": return `${what} sent`;
      case "failed": return `${what} didn't send`;
      case "demo": return `${what} (demo, not really sent)`;
      case "not_setup": return `${what} not set up yet`;
      case "no_number": return "no mobile number for texts";
      case "quiet": return "no text (quiet hours)";
      default: return null;
    }
  };
  return [part(email, "Email"), part(sms, "Text")].filter(Boolean).join(" · ") || "In KIN only";
}
