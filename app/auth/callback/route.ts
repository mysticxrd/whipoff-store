import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeGuestCartIntoUser } from "@/lib/cart/service";

// Completes the Supabase magic-link sign-in: exchanges the `code` param for a session, then
// merges the guest httpOnly-cookie cart into the now-signed-in user's DB cart (Slice 2 AC#5)
// before redirecting on. This route did not exist before Slice 2 — signInWithOtp's
// emailRedirectTo pointed straight at /account, which only works for the older implicit flow;
// @supabase/ssr uses the PKCE flow, which requires this server-side code exchange. Closing this
// gap gives merge-on-sign-in a single, guaranteed hook point (a Server Component render can read
// but not clear the guest cookie — see lib/cart/cookie.ts — so the merge must happen here).
function safeRedirectPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/account";
  return path;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await mergeGuestCartIntoUser(data.user.id);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
