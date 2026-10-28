import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { letterReadingOn, readLetter, readLetterText } from "@/lib/letters";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Receives forwarded emails from an inbound email service (Postmark's inbound JSON format;
 * Resend and others can be mapped to the same fields) and reads them like letters.
 * The service must call https://<site>/api/inbound/email?secret=<KIN_INBOUND_SECRET>.
 */
type Inbound = { To?: string; ToFull?: { Email: string }[]; OriginalRecipient?: string; From?: string; Subject?: string; TextBody?: string; HtmlBody?: string;
  Attachments?: { Name: string; Content: string; ContentType: string; ContentLength?: number }[] };

const strip = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ");

export async function POST(req: NextRequest) {
  const secret = process.env.KIN_INBOUND_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin || !letterReadingOn()) return NextResponse.json({ ok: false, reason: "not set up" });
  const mail = (await req.json().catch(() => ({}))) as Inbound;
  const to = [mail.OriginalRecipient, mail.To, ...(mail.ToFull || []).map((x) => x.Email)].filter(Boolean).join(" ").toLowerCase();
  const token = to.match(/kin-([0-9a-f]{16})@/)?.[1];
  if (!token) return NextResponse.json({ ok: true, ignored: "no address" });
  const { data: addr } = await admin.from("inbound_addresses").select("circle_id").eq("token", token).maybeSingle();
  if (!addr) return NextResponse.json({ ok: true, ignored: "unknown address" });
  const { data: circle } = await admin.from("care_circles").select("id, kind, person_name, preferred_name").eq("id", addr.circle_id).single();
  // Daily limit per family
  const day = new Date().toISOString().slice(0, 10);
  const { count } = await admin.from("letter_scans").select("id", { count: "exact", head: true }).eq("circle_id", circle!.id).eq("source", "email").gte("created_at", day);
  if ((count || 0) >= 20) return NextResponse.json({ ok: true, ignored: "daily limit" });

  const kind = (circle!.kind || "care") as "care" | "children";
  const att = (mail.Attachments || []).find((a) => /^(application\/pdf|image\/(png|jpe?g|webp|gif))$/.test(a.ContentType) && (a.ContentLength || a.Content.length) < 8_000_000);
  let result;
  try {
    const body = (mail.TextBody || strip(mail.HtmlBody || "")).trim();
    if (att && body.length < 200) result = await readLetter(Buffer.from(att.Content, "base64").buffer as ArrayBuffer, att.ContentType, kind);
    else result = await readLetterText(`From: ${mail.From || ""}\nSubject: ${mail.Subject || ""}\n\n${body}`, kind);
  } catch (e) {
    console.error("inbound read failed", e);
    return NextResponse.json({ ok: false });
  }
  const { data: scan } = await admin.from("letter_scans").insert({ circle_id: circle!.id, result, source: "email", created_by: null }).select("id").single();
  await admin.from("activity").insert({ circle_id: circle!.id, actor: null, verb: "forwarded an email that Many Hands read, from", subject: result.organisation });
  const { data: fam } = await admin.from("memberships").select("user_id").eq("circle_id", circle!.id).eq("status", "active").in("role", ["admin", "family"]);
  if (scan) await notify({
    circleId: circle!.id, circleName: kind === "children" ? circle!.person_name : `${circle!.preferred_name}'s Care Circle`, actor: "00000000-0000-0000-0000-000000000000",
    to: (fam || []).map((m) => m.user_id), level: "answer", title: `Many Hands read an email from ${result.organisation}`,
    body: `${result.summary} ${result.suggestions.length ? `${result.suggestions.length} suggested ${result.suggestions.length === 1 ? "task" : "tasks"} to review.` : ""}`.trim(), path: `/letters/${scan.id}`,
  });
  return NextResponse.json({ ok: true });
}
