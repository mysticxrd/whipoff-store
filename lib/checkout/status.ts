import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Return-page state derivation — SERVER-SIDE ONLY. checkout_sessions and orders are queried
// with the admin client because the shopper (often a guest) has no RLS path to either row;
// the page then renders ONLY a coarse state, never row data ("drop the echo": no email, no
// ₹total on the return screen — that posture shipped with the Stripe return page and is
// preserved verbatim). The order_id in the URL is untrusted: it is Zod-parsed by the page
// (checkoutReturnQuerySchema) before it reaches this query, and knowing someone else's
// order_… id yields nothing but a generic state word.

export type CheckoutReturnState = "confirmed" | "processing" | "failed" | "not_found";

/**
 * confirmed  — the webhook already wrote the Order (record_paid_order ran).
 * processing — payment done client-side but the webhook hasn't landed yet, or is retrying.
 * failed     — Razorpay reported payment.failed and no order exists (retry still possible;
 *              failed_at is telemetry, not a terminal state — a later success supersedes it).
 * not_found  — the order_id matches nothing we staged (typo, foreign id, or pruned row).
 */
export async function getCheckoutReturnState(
  providerOrderId: string,
): Promise<CheckoutReturnState> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (order) return "confirmed";

  const { data: session } = await admin
    .from("checkout_sessions")
    .select("status, failed_at")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (!session) return "not_found";
  if (session.failed_at) return "failed";
  return "processing";
}
