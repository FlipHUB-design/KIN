import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server-only, used solely for deleting a user's own account. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
