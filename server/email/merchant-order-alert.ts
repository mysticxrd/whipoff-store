import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureServerEvent } from "@/lib/analytics-server";
import {
  composeMerchantOrderAlert,
  renderMerchantOrderAlert,
} from "@/lib/email/merchant-alert";
import { getMerchantNotifyEmail } from "@/lib/env-server";
import { sendEmail } from "@/server/email/send";
import type { Database } from "@/supabase/types";

const ORDER_SELECT =
  "id, user_id, email, status, currency, amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor, shipping_name, shipping_address, order_seq, paid_at, created_at, merchant_notify_email_sent_at";

type Admin = SupabaseClient<Database>;

export type MerchantOrderAlertHooks = {
  /**
   * The webhook uses this signal to return 500 for the same provider event, so a
   * transient failure retries through `duplicate_event`. Independent of the customer
   * confirmation path — either channel can fail without blocking the other.
   */
  onRetryableFailure?: () => void;
};

function logMerchant(event: string, detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ source: "merchant-order-email", event, ...detail }));
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
  opts: { sentry: boolean; retryable: boolean; hooks?: MerchantOrderAlertHooks },
): Promise<void> {
  if (opts.sentry) {
    Sentry.captureMessage(`merchant order alert failed: ${reason}`, "error");
  }
  logMerchant("send_failed", { provider_order_id: providerOrderId, reason });
  await captureServerEvent(
    "order_merchant_notify_email_failed",
    { provider_order_id: providerOrderId, reason },
    distinctId,
  );
  if (opts.retryable) opts.hooks?.onRetryableFailure?.();
}

/**
 * Send the merchant packing-sheet email for a paid order. Never throws into the webhook.
 * Separate marker + Resend key from the customer receipt so the two channels are independent.
 */
export async function sendMerchantOrderAlertForOrder(
  admin: Admin,
  providerOrderId: string,
  hooks?: MerchantOrderAlertHooks,
): Promise<void> {
  try {
    let merchantEmail: string | null;
    try {
      merchantEmail = getMerchantNotifyEmail();
    } catch (error) {
      await recordFailure(
        providerOrderId,
        "ops",
        error instanceof Error ? error.message : "invalid MERCHANT_NOTIFY_EMAIL",
        { sentry: true, retryable: false, hooks },
      );
      return;
    }
    if (!merchantEmail) {
      logMerchant("skipped", {
        provider_order_id: providerOrderId,
        reason: "merchant_notify_email_unset",
      });
      return;
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (orderError) {
      await recordFailure(providerOrderId, "ops", "order_lookup_failed", {
        sentry: true,
        retryable: true,
        hooks,
      });
      return;
    }
    if (!order) {
      logMerchant("skipped", { provider_order_id: providerOrderId, reason: "no_order_row" });
      return;
    }
    if (order.status !== "paid") {
      logMerchant("skipped", {
        provider_order_id: providerOrderId,
        reason: `status_${order.status}`,
      });
      return;
    }
    if (order.merchant_notify_email_sent_at !== null) {
      logMerchant("skipped", { provider_order_id: providerOrderId, reason: "already_sent" });
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

    const composed = composeMerchantOrderAlert(order, items ?? [], merchantEmail);
    if (!composed.ok) {
      await recordFailure(providerOrderId, distinctId, "compose_failed", {
        sentry: true,
        retryable: false,
        hooks,
      });
      return;
    }

    const rendered = renderMerchantOrderAlert(composed.alert);
    const sent = await sendEmail({
      idempotencyKey: `order-merchant/${providerOrderId}`,
      to: composed.alert.merchantEmail,
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

    const { error: markError } = await admin.rpc("mark_order_merchant_notify_email_sent", {
      p_order_id: order.id,
    });
    if (markError) {
      Sentry.captureMessage(
        "merchant order alert sent but marker write failed (provider idempotency key retained)",
        "warning",
      );
      logMerchant("mark_failed", { provider_order_id: providerOrderId, order_id: order.id });
    }

    logMerchant("sent", {
      provider_order_id: providerOrderId,
      order_number: composed.alert.orderNumber,
      provider_id: sent.providerId,
    });
    await captureServerEvent(
      "order_merchant_notify_email_sent",
      {
        provider_order_id: providerOrderId,
        value_minor: composed.alert.amountTotalMinor,
        currency: composed.alert.currency,
      },
      distinctId,
    );
  } catch {
    Sentry.captureMessage("merchant order alert failed: unexpected_error", "error");
    logMerchant("send_failed", {
      provider_order_id: providerOrderId,
      reason: "unexpected_error",
    });
    hooks?.onRetryableFailure?.();
  }
}
