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

const ORDER_SELECT =
  "id, user_id, email, status, currency, amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor, shipping_name, shipping_address, order_seq, paid_at, created_at, confirmation_email_sent_at";

type Admin = SupabaseClient<Database>;

export type OrderConfirmationHooks = {
  /**
   * The webhook uses this signal to return 500 for the same provider event, so a
   * transient failure retries through `duplicate_event`. The sibling paid-family
   * event returns `duplicate_order` and never enters the receipt path.
   */
  onRetryableFailure?: () => void;
};

function logEmail(event: string, detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ source: "order-email", event, ...detail }));
}

function isRetryableSendFailure(reason: string): boolean {
  if (reason === "network_error") return true;
  const status = /^resend_http_(\d{3})(?:_|$)/.exec(reason)?.[1];
  if (!status) return false;
  const code = Number(status);
  return code === 408 || code === 425 || code === 429 || code >= 500;
}

async function recordFailure(
  providerOrderId: string,
  distinctId: string,
  reason: string,
  opts: { sentry: boolean; retryable: boolean; hooks?: OrderConfirmationHooks },
): Promise<void> {
  if (opts.sentry) {
    // Only bounded internal/provider codes reach Sentry; database/provider messages and
    // recipient data are deliberately excluded.
    Sentry.captureMessage(`order confirmation email failed: ${reason}`, "error");
  }
  logEmail("send_failed", { provider_order_id: providerOrderId, reason });
  await captureServerEvent(
    "order_confirmation_email_failed",
    { provider_order_id: providerOrderId, reason },
    distinctId,
  );
  if (opts.retryable) opts.hooks?.onRetryableFailure?.();
}

/**
 * Send the confirmation email for a paid order. This function never throws into the
 * webhook. The sent marker prevents completed duplicates; Resend's deterministic
 * idempotency key prevents duplicate delivery if a timeout occurred after provider
 * acceptance but before the marker write.
 */
export async function sendOrderConfirmationForOrder(
  admin: Admin,
  providerOrderId: string,
  hooks?: OrderConfirmationHooks,
): Promise<void> {
  try {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (orderError) {
      await recordFailure(providerOrderId, "guest", "order_lookup_failed", {
        sentry: true,
        retryable: true,
        hooks,
      });
      return;
    }
    if (!order) {
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
      await recordFailure(providerOrderId, distinctId, "items_lookup_failed", {
        sentry: true,
        retryable: true,
        hooks,
      });
      return;
    }

    const composed = composeOrderConfirmationEmail(order, items ?? []);
    if (!composed.ok) {
      await recordFailure(providerOrderId, distinctId, "compose_failed", {
        sentry: true,
        retryable: false,
        hooks,
      });
      return;
    }

    const rendered = renderOrderConfirmationEmail(composed.receipt, clientEnv.NEXT_PUBLIC_APP_URL);
    const sent = await sendEmail({
      idempotencyKey: `order-receipt/${providerOrderId}`,
      to: composed.receipt.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (!sent.ok) {
      await recordFailure(providerOrderId, distinctId, sent.reason, {
        sentry: sent.reason !== "not_configured",
        retryable: isRetryableSendFailure(sent.reason),
        hooks,
      });
      return;
    }

    const { error: markError } = await admin.rpc("mark_order_confirmation_email_sent", {
      p_order_id: order.id,
    });
    if (markError) {
      Sentry.captureMessage(
        "order confirmation sent but marker write failed (provider idempotency key retained)",
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
  } catch {
    Sentry.captureMessage("order confirmation email failed: unexpected_error", "error");
    logEmail("send_failed", {
      provider_order_id: providerOrderId,
      reason: "unexpected_error",
    });
    hooks?.onRetryableFailure?.();
  }
}
