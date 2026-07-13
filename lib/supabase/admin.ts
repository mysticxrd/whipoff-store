import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/env-server";
import type { Database } from "@/supabase/types";

// SERVICE-ROLE Supabase client — bypasses RLS by design (payments.md: the payment webhook
// is the only writer of order state, and orders/payment_events/checkout_sessions have no
// client write policies at all). Imported from the payment webhook (app/api/webhooks/razorpay/
// route.ts), the checkout Server Action's staging write (lib/checkout/service.ts), and the
// return-state read (lib/checkout/status.ts) — every OTHER server path uses lib/supabase/
// server.ts (anon key, RLS enforced). Not request-bound: no cookies, no session persistence —
// it is a machine credential, not a user.

export function createAdminClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    getSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
