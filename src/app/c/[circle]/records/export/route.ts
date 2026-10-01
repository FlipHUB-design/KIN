import { NextResponse, type NextRequest } from "next/server";
import { getCircle } from "@/lib/data";
import { canEdit, TZ } from "@/lib/kin";
import { buildRecords } from "@/lib/records";

const cell = (v: string) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, role, nameOf, circle, user } = await getCircle(id);
  if (!canEdit(role)) return new NextResponse("Not found", { status: 404 });
  const type = req.nextUrl.searchParams.get("type");
  const all = (await buildRecords(supabase, id, nameOf))
    .filter((r) => !type || r.type === type);
  const fmt = (s: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(s));
  const me = (await supabase.from("profiles").select("display_name").eq("id", user.id).single()).data?.display_name || "You";
  const rows = [["Date and time (UK)", "Type", "Who", "What", "Status"], ...all.map((r) => [fmt(r.at), r.type, r.who === "You" ? me : r.who, r.text, r.status || ""])];
  await supabase.from("audit_log").insert({ circle_id: id, actor: user.id, action: "records.export", detail: { type } });
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kin-records-${circle.person_name.replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
