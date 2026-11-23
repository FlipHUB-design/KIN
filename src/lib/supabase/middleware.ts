import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/signup", "/auth", "/invite", "/forgot", "/privacy", "/demo", "/api/cron", "/manifest.webmanifest", "/screen", "/api/ical", "/api/inbound", "/waitlist", "/og-waitlist.png"];
// Machine-to-machine routes check their own secret or token: no sign-in work needed
const SKIP = ["/api/cron", "/api/ical", "/api/inbound", "/manifest.webmanifest", "/og-waitlist.png"];
const under = (path: string, p: string) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/"));

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (SKIP.some((p) => under(path, p))) return NextResponse.next({ request });
  const isPublic = PUBLIC.some((p) => under(path, p));

  // Nobody signed in (no session cookie): decide straight away, without a trip to the sign-in server
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) {
    if (isPublic) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}
