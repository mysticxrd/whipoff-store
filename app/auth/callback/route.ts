import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeGuestCartIntoUser } from "@/lib/cart/service";
import { authCallbackSchema, safeReturnTo } from "@/lib/contracts";

// Completes the Supabase magic-link sign-in: exchanges the PKCE `code` for a session, then runs
// the two guest → auth transition steps at the one guaranteed post-verification hook point.
//
// This route did not exist before Slice 2 — @supabase/ssr uses the PKCE flow, which requires a
// server-side code exchange (a Server Component render can read but not clear the guest cookie —
// see lib/cart/cookie.ts — so the merge must happen here). Slice 4 adds the guest ORDER claim on
// the same hook: right after the session is established is exactly when auth.email() first
// resolves to a verified mailbox.
//
// Open-redirect guard: the post-verify destination arrives as ?redirectTo (set by the auth
// middleware when it bounces a guest off a protected page, and by the sign-in action). It is
// NEVER trusted raw — it is run through the shared safeReturnTo() (same-origin paths only, unsafe
// values fall back to /account). This replaces the older, weaker local guard.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  // Sanitized unconditionally — even a missing/failed verification must land on a safe path.
  const redirectTo = safeReturnTo(searchParams.get("redirectTo"));
  // The contract is the single source of truth for this route's input: PKCE `code` only.
  // No valid code → skip the exchange and just redirect safely.
  const params = authCallbackSchema.safeParse({
    code: searchParams.get("code") ?? undefined,
    redirectTo: searchParams.get("redirectTo") ?? undefined,
  });

  if (params.success) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.data.code);
    if (!error && data.user) {
      // Attach any orders this now-verified mailbox placed as a guest. claim_guest_orders() is
      // parameterless: it matches on the verified JWT email (auth.email()), not a client
      // argument, and only touches rows where user_id IS NULL — a client cannot influence which
      // orders are claimed. Idempotent + best-effort: a failure here never blocks sign-in, and
      // the next sign-in retries.
      try {
        await supabase.rpc("claim_guest_orders", {});
      } catch {
        // Non-fatal — unclaimed orders remain matchable on the next sign-in.
      }
      // Merge the guest cookie cart into the user's DB cart (Slice 2 AC#5).
      await mergeGuestCartIntoUser(data.user.id);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
