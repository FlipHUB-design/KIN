import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens a document through a short-lived link, after the database confirms the
// viewer may see it. Every open is written to the access log.
export async function GET(req: NextRequest, { params }: { params: Promise<{ circle: string; id: string }> }) {
  const { circle, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).eq("circle_id", circle).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (!signed) return new NextResponse("Not found", { status: 404 });
  await supabase.from("audit_log").insert({ circle_id: circle, actor: user.id, action: "document.view", detail: { name: doc.name } });
  return NextResponse.redirect(signed.signedUrl);
}
