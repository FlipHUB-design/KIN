import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_ENABLED, PERSONAS, demoEmail, ensureDemo, isKidsPersona, type Persona } from "@/lib/demo";

// Signs the visitor in as a demo persona with a one-time token made on the
// server. No password is used or shown.
export async function GET(req: NextRequest, { params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  const fail = (m: string) => NextResponse.redirect(new URL(`/demo?error=${encodeURIComponent(m)}`, req.url));
  if (!DEMO_ENABLED) return fail("The demo is switched off.");
  if (!(persona in PERSONAS)) return fail("That person isn't in the demo.");
  const admin = createAdminClient();
  if (!admin) return fail("The demo isn't set up on this server yet.");
  let circles: { care: string; kids: string };
  try {
    circles = await ensureDemo(admin);
  } catch (e) {
    console.error("demo seed failed", e);
    return fail("The demo couldn't be prepared. Please try again in a minute.");
  }
  const [{ data, error }, supabase] = await Promise.all([
    admin.auth.admin.generateLink({ type: "magiclink", email: demoEmail(persona as Persona) }),
    createClient(),
  ]);
  if (error || !data.properties?.hashed_token) return fail("Couldn't sign you in to the demo.");
  // Clear any earlier session in this browser only: no need to wait for the sign-in server
  await supabase.auth.signOut({ scope: "local" });
  const v = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (v.error) return fail("Couldn't sign you in to the demo.");
  return NextResponse.redirect(new URL(`/c/${isKidsPersona(persona as Persona) ? circles.kids : circles.care}`, req.url));
}
