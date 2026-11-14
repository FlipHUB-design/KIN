import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEdit, type Role } from "@/lib/kin";

/** The owner's on/off switch for suggestions (on unless switched off). */
export async function helpfulOn() {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data } = await admin.from("app_settings").select("value").eq("key", "helpful").maybeSingle();
  return data?.value?.on !== false;
}

/** Whether to show suggestions to this person: switched on, they're a parent or organiser, and they haven't hidden them. */
export async function showHelpful(supabase: SupabaseClient, userId: string, role: Role | null) {
  if (!canEdit(role)) return false;
  if (!(await helpfulOn())) return false;
  const { data } = await supabase.from("profiles").select("hide_helpful").eq("id", userId).maybeSingle();
  return !data?.hide_helpful;
}
