import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/analytics-server";
import {
  paymentEventIdSchema,
  razorpayWebhookEventSchema,
  type RazorpayWebhookEvent,
} from "@/lib/contracts";
import { sendOrderConfirmationForOrder } from "@/server/email/order-confirmation";

// Razorpay webhook — THE writer of order state (payments.md, unchanged from the Stripe era).
// Everything else about orders is read-only. Posture:
//  - nodejs runtime + RAW body: x-razorpay-signature is HMAC-SHA256 over the exact bytes
//    Razorpay sent — verify FIRST, before any JSON.parse of the payload.
//  - Idempotent: the RPCs claim the x-razorpay-event-id header first and key orders on the
//    unique provider_order_id, so retries and duplicates no-op ('duplicate_*' → 200).
//  - PERMANENT failures (unparseable envelope, session_not_found, amount_mismatch) → 200 +
//    loud alert; a retry storm cannot heal them. TRANSIENT failures (DB down, RPC error) →
//    500 so Razorpay redelivers.
//  - Entitlement before fulfilment: the paid hook fires only after (a) signature verified,
//    (b) envelope re-parsed with the Zod contract, (c) record_paid_order cross-checked the
//    captured amount against the STAGED total and actually inserted the order — never off
//    the return URL or the modal callback.
//  - payment.failed is NOT terminal (Razorpay lets the shopper retry within the same order):
//    mark_checkout_failed stamps failed_at telemetry only; no cancelled Order is ever written.
//  - Writes go through the service-role client (bypasses RLS by design).
//  - Confirmation email is a POST-COMMIT side-effect gated on the order's own send marker,
//    attempted on every paid-family event (including 'duplicate_*' redeliveries) so a
//    crash-during-email heals on retry — and it can NEVER throw into this handler.

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) {
    return new Response("Missing signature", { status: 400 });
  }
  const eventIdParse = paymentEventIdSchema.safeParse(
    request.headers.get("x-razorpay-event-id"),
  );
  if (!eventIdParse.success) return new Response("Missing event id", { status: 400 });
  const eventId = eventIdParse.data;

  // request.text() BEFORE any parsing — the HMAC covers the untransformed raw body.
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature)) {
    // Unverified = rejected, no detail leaked (api_conventions.md).
    return new Response("Invalid signature", { status: 400 });
  }

  // Signature-verified — NOW parse. An envelope we can't parse is PERMANENT (200 + alert).
  let event: RazorpayWebhookEvent;
  try {
    const parsed = razorpayWebhookEventSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      // Includes event types we didn't subscribe this handler to — acknowledge, don't retry.
      return NextResponse.json({ received: true, skipped: "unhandled_or_malformed" });
    }
    event = parsed.data;
  } catch {
    Sentry.captureMessage("razorpay webhook: signed but unparseable body", "error");
    return NextResponse.json({ received: true, skipped: "unparseable" });
  }

  const payment = event.payload.payment.entity;
  try {
    if (event.event === "payment.failed") {
      return await handlePaymentFailed(eventId, event.event, payment.order_id);
    }
    // order.paid and payment.captured both mean money captured — same RPC, idempotent on
    // both the event ledger AND the unique provider_order_id, so subscribing to both is safe.
    return await handlePaid(eventId, event.event, payment.order_id, payment.id, payment.amount);
  } catch (error) {
    // Transient (DB unreachable, RPC failure) → 500 so Razorpay RETRIES.
    Sentry.captureException(error);
    console.error(
      JSON.stringify({
        source: "razorpay-webhook",
        event: "handler_failed",
        type: event.event,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response("Webhook handler failed", { status: 500 });
  }
}

/** order.paid / payment.captured → write the paid order atomically via record_paid_order. */
async function handlePaid(
  eventId: string,
  eventType: string,
  providerOrderId: string,
  providerPaymentId: string,
  amountPaidMinor: number,
): Promise<Response> {
  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("record_paid_order", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_provider_order_id: providerOrderId,
    p_provider_payment_id: providerPaymentId,
    p_amount_paid_minor: amountPaidMinor,
  });
  if (error) throw new Error(`record_paid_order failed: ${error.message}`);

  if (outcome === "session_not_found" || outcome === "amount_mismatch") {
    // PERMANENT: money was captured for something we can't reconcile — the loudest alert we
    // have, but 200 (a retry storm cannot heal it; the RPC rolled back its ledger claim, so a
    // later manual replay after fixing data CAN still land).
    Sentry.captureMessage(
      `razorpay webhook: captured payment unreconcilable (${outcome})`,
      "error",
    );
    console.error(
      JSON.stringify({
        source: "razorpay-webhook",
        event: "unreconcilable_payment",
        reason: outcome,
        provider_order_id: providerOrderId,
      }),
    );
    return NextResponse.json({ received: true, skipped: outcome });
  }

  if (outcome === "inserted") {
    await emitPaidOrderEvents(providerOrderId, amountPaidMinor);
    await triggerFulfilment(providerOrderId);
  }

  // Confirmation email, AFTER the order commit (email.md send-after-commit). Called on every
  // outcome ('inserted' AND 'duplicate_*'): the send is gated on the order's OWN marker, not
  // this event's ledger claim, so a redelivery after a crash-during-email recovers the
  // receipt (prefer-delivery model). Never throws.
  await sendOrderConfirmationForOrder(admin, providerOrderId);

  return NextResponse.json({ received: true, result: outcome });
}

/** payment.failed → stamp failed_at telemetry on the staging row. NOT terminal (see header). */
async function handlePaymentFailed(
  eventId: string,
  eventType: string,
  providerOrderId: string,
): Promise<Response> {
  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("mark_checkout_failed", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_provider_order_id: providerOrderId,
  });
  if (error) throw new Error(`mark_checkout_failed failed: ${error.message}`);

  if (outcome === "session_not_found") {
    Sentry.captureMessage("razorpay webhook: payment.failed for unknown order", "warning");
  }
  return NextResponse.json({ received: true, result: outcome });
}

/** Authoritative revenue events, server-side (observability.md taxonomy). */
async function emitPaidOrderEvents(
  providerOrderId: string,
  amountMinor: number,
): Promise<void> {
  const props = {
    provider_order_id: providerOrderId,
    value_minor: amountMinor,
    currency: "INR",
  };
  // The webhook has no auth context; the order row carries ownership. Revenue events are
  // keyed to the order id — user-level joins happen on the order, not the analytics id.
  await captureServerEvent("payment_succeeded", props, providerOrderId);
  await captureServerEvent("order_completed", props, providerOrderId);
}

/**
 * Fulfilment hook — still a structured log: fulfilment tooling (and its shipping email) has no
 * operator trigger yet (PRD Slice-5 scope OUT). The confirmation email no longer rides this —
 * it is sent via sendOrderConfirmationForOrder above, gated on the order's send marker.
 */
async function triggerFulfilment(providerOrderId: string): Promise<void> {
  console.log(
    JSON.stringify({
      source: "fulfilment",
      event: "order_paid_hook",
      provider_order_id: providerOrderId,
    }),
  );
}
