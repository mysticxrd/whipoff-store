import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed the `middleware` file convention to `proxy` (same request-interception
// semantics, clearer name). Session refresh + the zero-trust gateway live in updateSession().
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all routes except static assets, image files, and the Stripe webhook. Session
  // refresh happens everywhere; protected-route enforcement lives in updateSession().
  // api/webhooks is machine-to-machine: no shopper session to refresh, and nothing may
  // touch the request before the raw-body signature check (payments.md) — deliberate.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
