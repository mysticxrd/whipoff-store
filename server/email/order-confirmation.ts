import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { captureServerEvent } from "@/lib/analytics-server";
import {
  composeOrderConfirmationEmail,
  renderOrderConfirmationEmail,
} from "@/lib/email/pure";
import { sendEmail } from "@/server/email/send";
import type { Database } from "@/supabase/types";

// Order-confirmation orchestrator — the webhook's post-commit email side-effect (PRD Slice-5).
//
// CONTRACT: NEVER throws. The caller is the payment webhook, whose top-level catch returns 500
// (= the provider retries); an email failure escaping this function would turn "receipt delayed"
// into "webhook lied about a written order". Everything is caught, recorded (Sentry + the
// order_confirmation_email_failed event, observability.md), and swallowed (PRD AC 4).
//
// IDEMPOTENCY (PRD AC 3): gated on orders.confirmation_email_sent_at, NOT the payment_events
// ledger — the ledger dedups the ORDER WRITE, this marker dedups the SEND (01_data migration
// rationale). The webhook calls this on EVERY paid-family event it handles, including duplicate
// deliveries: a marker already set → skip; a marker still NULL after a crash-during-email →
// the provider's retry lands here and the receipt is recovered instead of permanently dropped.
//
// PREFER-DELIVERY ORDERING (Gate-1 #5, human-set): SEND first, THEN mark via the service-role
// RPC mark_order_confirmation_email_sent(). A crash between the two re-sends on retry (rare
// duplicate) rather than silently dropping the receipt. A mark failure after a successful send
// is therefore recorded but non-fatal — the accepted duplicate-risk edge, not an error state.

// Single literal (not concatenation): supabase-js infers the row shape from this string's
// TYPE — `+` yields plain `string`, degrading the result to GenericStringError.
const ORDER_SELECT =
  "id, user_id, email, status, currency, amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor, shipping_name, shipping_address, order_seq, paid_at, created_at, confirmation_email_sent_at";

type Admin = SupabaseClient<Database>;

function logEmail(event: string, detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ source: "order-email", event, ...detail }));
}

async function recordFailure(
  providerOrderId: string,
  distinctId: string,
  reason: string,
  opts: { sentry: boolean },
): Promise<void> {
  if (opts.sentry) {
    Sentry.captureMessage(`order confirmation email failed: ${reason}`, "error");
  }
  logEmail("send_failed", { provider_order_id: providerOrderId, reason });
  await captureServerEvent(
    "order_confirmation_email_failed",
    { provider_order_id: providerOrderId, reason },
    distinctId,
  );
}

/**
 * Send the confirmation email for the paid order belonging to a provider order id, exactly
 * once. Self-gating: looks the order up itself (service-role read of the PERSISTED row —
 * content always reflects committed state, email.md "send after the order write commits") and
 * returns quietly when there is nothing to do (order missing, not paid, or already emailed).
 */
export async function sendOrderConfirmationForOrder(
  admin: Admin,
  providerOrderId: string,
): Promise<void> {
  try {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (orderError) {
      await recordFailure(providerOrderId, "guest", `order_lookup_failed: ${orderError.message}`, {
        sentry: true,
      });
      return;
    }
    if (!order) {
      // Unreconcilable/failed attempts reach here via the always-attempt call site — not a failure.
      logEmail("skipped", { provider_order_id: providerOrderId, reason: "no_order_row" });
      return;
    }
    if (order.status !== "paid") {
      logEmail("skipped", { provider_order_id: providerOrderId, reason: `status_${order.status}` });
      return;
    }
    if (order.confirmation_email_sent_at !== null) {
      logEmail("skipped", { provider_order_id: providerOrderId, reason: "already_sent" });
      return;
    }

    const distinctId = order.user_id ?? "guest";

    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("product_title, variant_title, sku, unit_price_minor, quantity, line_total_minor")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });
    if (itemsError) {
      await recordFailure(providerOrderId, distinctId, `items_lookup_failed: ${itemsError.message}`, {
        sentry: true,
      });
      return;
    }

    const composed = composeOrderConfirmationEmail(order, items ?? []);
    if (!composed.ok) {
      // PERMANENT: a retry re-reads the same rows — record loudly, don't loop.
      await recordFailure(providerOrderId, distinctId, `compose_failed: ${composed.reason}`, {
        sentry: true,
      });
      return;
    }

    const rendered = renderOrderConfirmationEmail(composed.receipt, clientEnv.NEXT_PUBLIC_APP_URL);
    const sent = await sendEmail({
      to: composed.receipt.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (!sent.ok) {
      // not_configured = the deliberate local/mock posture — observable but not a Sentry alarm.
      await recordFailure(providerOrderId, distinctId, sent.reason, {
        sentry: sent.reason !== "not_configured",
      });
      return;
    }

    // PREFER-DELIVERY step 2: the email is out — record it. Marker failure ≠ send failure.
    const { error: markError } = await admin.rpc("mark_order_confirmation_email_sent", {
      p_order_id: order.id,
    });
    if (markError) {
      Sentry.captureMessage(
        `order confirmation sent but marker write failed (duplicate-risk accepted): ${markError.message}`,
        "warning",
      );
      logEmail("mark_failed", { provider_order_id: providerOrderId, order_id: order.id });
    }

    logEmail("sent", {
      provider_order_id: providerOrderId,
      order_number: composed.receipt.orderNumber,
      provider_id: sent.providerId,
    });
    await captureServerEvent(
      "order_confirmation_email_sent",
      {
        provider_order_id: providerOrderId,
        value_minor: composed.receipt.amountTotalMinor,
        currency: composed.receipt.currency,
      },
      distinctId,
    );
  } catch (error) {
    // Belt-and-braces: NOTHING escapes into the webhook's 500 path.
    Sentry.captureException(error);
    logEmail("send_failed", {
      provider_order_id: providerOrderId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
