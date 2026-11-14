import "server-only";
import { getUser } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

/** The app owner(s): signed-in people whose email is in ADMIN_EMAILS (comma separated). */
export async function ownerOnly() {
  const { user } = await getUser();
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const ok = !!user?.email && allowed.includes(user.email.toLowerCase());
  return { user, ok, configured: allowed.length > 0, admin: ok ? createAdminClient() : null };
}

export type WaitRow = { id: string; email: string; name: string | null; kind: string; note: string | null; source: string | null; created_at: string };
export const KIND_LABEL: Record<string, string> = { coparent: "Co-parent", carer: "Caring for someone older", both: "Both", other: "Just interested" };
