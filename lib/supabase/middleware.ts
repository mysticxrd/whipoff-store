import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import { isProtectedPath } from "@/lib/auth/protected";

/**
 * Refreshes the Supabase session cookie on every matched request and enforces the
 * zero-trust gateway: unauthenticated requests to a protected prefix are redirected to
 * sign-in. This is the coarse gate — Server Actions re-check identity and RLS re-checks
 * rows (defense-in-depth, security_shield.md #5).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with the auth server — never trust getSession() here.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Offline / unconfigured (e.g. placeholder env in Slice 0) → treat as no session.
    user = null;
  }

  const path = request.nextUrl.pathname;
  if (isProtectedPath(path) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  return response;
}
