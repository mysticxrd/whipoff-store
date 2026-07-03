import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/env-server";
import type { Database } from "@/supabase/types";

// SERVICE-ROLE Supabase client — bypasses RLS by design (payments.md: the Stripe webhook
// is the only writer of order state, and orders/stripe_events have no client write policies
// at all). Import this ONLY from app/api/webhooks/stripe/route.ts; every other server path
// uses lib/supabase/server.ts (anon key, RLS enforced). Not request-bound: no cookies, no
// session persistence — it is a machine credential, not a user.

export function createAdminClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    getSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
