import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exports everything the signed-in user is allowed to see. Row-level security
// in the database decides what that is.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  const tables = ["profiles", "care_circles", "memberships", "person_profiles", "visit_info", "emergency_info", "appointments",
    "tasks", "task_comments", "checkins", "activity", "contacts", "home_assets", "documents"];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email } };
  for (const t of tables) {
    const { data } = await supabase.from(t).select("*").limit(10000);
    out[t] = data || [];
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="kin-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
