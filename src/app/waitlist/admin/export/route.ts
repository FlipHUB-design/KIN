import { NextResponse } from "next/server";
import { KIND_LABEL, ownerOnly, type WaitRow } from "@/lib/owner";

export const dynamic = "force-dynamic";
const cell = (v: string | null) => { const s = String(v ?? ""); const safe = /^[=+\-@]/.test(s) ? "'" + s : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };

/** The waiting list as a CSV file, for the owner only. */
export async function GET() {
  const { ok, admin } = await ownerOnly();
  if (!ok || !admin) return new NextResponse("Not found", { status: 404 });
  const { data } = await admin.from("waitlist").select("*").order("created_at");
  const rows = (data || []) as WaitRow[];
  const csv = ["Joined,Name,Email,Describes them,Where from,What would help",
    ...rows.map((r) => [new Date(r.created_at).toISOString().slice(0, 16).replace("T", " "), r.name, r.email, KIND_LABEL[r.kind] || r.kind, r.source || "direct", r.note].map(cell).join(","))].join("\n");
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="many-hands-waiting-list.csv"' } });
}
