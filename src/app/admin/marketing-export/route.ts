import { NextResponse } from "next/server";
import { ownerOnly, type WaitRow } from "@/lib/owner";
import { isDemoEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";
const cell = (v: string | null | undefined) => { const s = String(v ?? ""); const safe = /^[=+\-@]/.test(s) ? "'" + s : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
const when = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

/** Everyone who ticked "Keep me in the loop", from accounts and the waiting list, one row per email. Owner only. */
export async function GET() {
  const { ok, admin } = await ownerOnly();
  if (!ok || !admin) return new NextResponse("Not found", { status: 404 });
  const out = new Map<string, string[]>();

  const { data: profs } = await admin.from("profiles").select("id, display_name, marketing_opt_in_at").eq("marketing_opt_in", true);
  const emails = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = data?.users || [];
    batch.forEach((u) => u.email && emails.set(u.id, u.email.toLowerCase()));
    if (batch.length < 1000) break;
  }
  for (const p of (profs || []) as { id: string; display_name: string | null; marketing_opt_in_at: string | null }[]) {
    const e = emails.get(p.id);
    if (e && !isDemoEmail(e)) out.set(e, [e, p.display_name || "", "Account", when(p.marketing_opt_in_at)]);
  }
  const { data: wait } = await admin.from("waitlist").select("*").eq("marketing_opt_in", true);
  for (const w of (wait || []) as WaitRow[]) {
    const e = w.email.toLowerCase();
    if (!out.has(e)) out.set(e, [e, w.name || "", "Waiting list", when(w.marketing_opt_in_at)]);
  }
  const csv = ["Email,Name,Signed up through,Agreed on", ...[...out.values()].map((r) => r.map(cell).join(","))].join("\n");
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="many-hands-in-the-loop.csv"' } });
}
