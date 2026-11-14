import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { amazonUrl, helpfulItem } from "@/lib/helpful";

export const dynamic = "force-dynamic";

/** Counts the click (no personal details), then sends the person on to Amazon. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ item: string }> }) {
  const found = helpfulItem((await params).item);
  if (!found) return NextResponse.redirect(new URL("/", req.url));
  const place = (req.nextUrl.searchParams.get("p") || "page").replace(/[^a-z-]/g, "").slice(0, 30);
  const admin = createAdminClient();
  if (admin) await admin.from("helpful_clicks").insert({ item: found.item.id, list: found.list.id, place, kind: found.list.kind });
  return NextResponse.redirect(amazonUrl(found.item), { headers: { "Referrer-Policy": "no-referrer" } });
}
