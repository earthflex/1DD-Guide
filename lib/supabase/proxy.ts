import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Paths reachable without a session. */
const PUBLIC_PATHS = ["/login", "/auth", "/g"];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

/** Refreshes the auth cookies on every request and sends logged-out users to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it can log users out at random.
  const { data } = await supabase.auth.getClaims();
  const { pathname, searchParams } = request.nextUrl;

  // Legacy share links: /?guide=<token> → /g/<token>
  const legacyToken = pathname === "/" ? searchParams.get("guide") : null;
  if (legacyToken) return NextResponse.redirect(new URL(`/g/${encodeURIComponent(legacyToken)}`, request.url));

  if (!data?.claims && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (data?.claims && pathname === "/login") {
    return NextResponse.redirect(new URL("/workspaces", request.url));
  }
  return response;
}
