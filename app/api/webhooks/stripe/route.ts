import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getStripe } from "@/lib/stripe";
import { getStripeWebhookSecret } from "@/lib/env-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/analytics-server";
import { checkoutSessionMetadataSchema } from "@/lib/contracts";
import { mapSessionToOrderPayload } from "@/lib/checkout/pure";
import type { Json } from "@/supabase/types";

// Stripe webhook — THE writer of order state (payments.md). Everything else about orders is
// read-only. Posture:
//  - nodejs runtime + RAW body: signature is verified against the exact bytes Stripe signed.
//  - Idempotent: the RPCs claim event.id first and key orders on the unique session id, so
//    retries and duplicates no-op ('duplicate_*' → 200).
//  - PERMANENT failures (malformed metadata, missing variant ids) → 200 + loud alert; a
//    retry storm cannot heal them. TRANSIENT failures (DB down, RPC error) → 500 so Stripe
//    redelivers.
//  - Entitlement before fulfilment: the paid hook fires only after (a) signature verified,
//    (b) payload mapped against real variant ids, (c) payment_status says paid, and (d) the
//    order row actually landed ('inserted'/'finalized') — never off the return URL.
//  - Writes go through the service-role client (bypasses RLS by design; this file is its
//    only importer).

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // req.text() BEFORE any parsing — constructEvent needs the untransformed raw body.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    // Unverified = rejected, no detail leaked (api_conventions.md).
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleSessionCompleted(event.id, event.type, event.data.object);
      case "checkout.session.async_payment_succeeded":
        return await handleAsyncFinalize(event.id, event.type, event.data.object, true);
      case "checkout.session.async_payment_failed":
        return await handleAsyncFinalize(event.id, event.type, event.data.object, false);
      default:
        // Not ours to handle — acknowledge so Stripe doesn't retry.
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    // Transient (DB unreachable, RPC failure, Stripe API hiccup) → 500 so Stripe RETRIES.
    Sentry.captureException(error);
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        event: "handler_failed",
        type: event.type,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response("Webhook handler failed", { status: 500 });
  }
}

/** checkout.session.completed → write the order (pending or paid) atomically via RPC. */
async function handleSessionCompleted(
  eventId: string,
  eventType: string,
  session: Stripe.Checkout.Session,
): Promise<Response> {
  // Variant linkage + Stripe's authoritative amounts ride on the expanded line items.
  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const mapped = mapSessionToOrderPayload(session, lineItems.data);
  if (!mapped.ok) {
    // PERMANENT: no retry can fix a malformed session — 200 + alert (no retry storm).
    Sentry.captureMessage(
      `stripe webhook: unprocessable checkout.session.completed (${mapped.reason})`,
      "error",
    );
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        event: "unprocessable_session",
        reason: mapped.reason,
        session_id: session.id,
      }),
    );
    return NextResponse.json({ received: true, skipped: mapped.reason });
  }

  if (mapped.subtotalMismatch) {
    // Reconciliation flag only — Stripe stays the money-truth, we never "correct" it.
    Sentry.captureMessage(
      "stripe webhook: session subtotal differs from creation-time snapshot",
      "warning",
    );
    console.warn(
      JSON.stringify({
        source: "stripe-webhook",
        event: "subtotal_mismatch",
        session_id: session.id,
      }),
    );
  }

  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("record_stripe_order", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_order: mapped.order as unknown as Json,
    p_items: mapped.items as unknown as Json,
    p_cart_id: mapped.cartId ?? undefined,
  });
  if (error) throw new Error(`record_stripe_order failed: ${error.message}`);

  if (outcome === "inserted" && mapped.order.status === "paid") {
    await emitPaidOrderEvents(session, mapped.userId);
    await triggerFulfilment(session.id, mapped.order.email);
  }

  return NextResponse.json({ received: true, result: outcome });
}

/** async_payment_succeeded/failed → transition the pending order via RPC (Gate-1 #2). */
async function handleAsyncFinalize(
  eventId: string,
  eventType: string,
  session: Stripe.Checkout.Session,
  paid: boolean,
): Promise<Response> {
  const metadata = checkoutSessionMetadataSchema.safeParse(session.metadata ?? {});
  const cartId =
    metadata.success && metadata.data.cart_id !== "guest" ? metadata.data.cart_id : null;
  const userId =
    metadata.success && metadata.data.user_id !== "guest" ? metadata.data.user_id : null;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("finalize_stripe_order", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_session_id: session.id,
    p_paid: paid,
    p_payment_intent_id: paymentIntent ?? undefined,
    p_cart_id: cartId ?? undefined,
  });
  if (error) throw new Error(`finalize_stripe_order failed: ${error.message}`);

  if (outcome === "order_not_pending") {
    // Disambiguate (migration.sql contract): order already transitioned → no-op 200;
    // order row not written yet (out-of-order delivery) → 500 so Stripe redelivers AFTER
    // checkout.session.completed lands. The RPC rolled back its event-ledger claim.
    const { data: existing, error: lookupError } = await admin
      .from("orders")
      .select("id, status")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (lookupError) throw new Error(`order lookup failed: ${lookupError.message}`);
    if (!existing) {
      throw new Error(
        `finalize arrived before checkout.session.completed for ${session.id} — retry`,
      );
    }
    return NextResponse.json({ received: true, result: "already_finalized" });
  }

  if (outcome === "finalized" && paid) {
    await emitPaidOrderEvents(session, userId);
    await triggerFulfilment(session.id, session.customer_details?.email ?? "unknown");
  }

  return NextResponse.json({ received: true, result: outcome });
}

/** Authoritative revenue events, server-side (observability.md taxonomy). */
async function emitPaidOrderEvents(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<void> {
  const props = {
    session_id: session.id,
    value_minor: session.amount_total ?? 0,
    currency: (session.currency ?? "inr").toUpperCase(),
  };
  const distinctId = userId ?? "guest";
  await captureServerEvent("payment_succeeded", props, distinctId);
  await captureServerEvent("order_completed", props, distinctId);
}

/**
 * Slice-5 hook point: fulfilment + confirmation email (Resend) attach HERE — after
 * entitlement is proven and the order row exists — never on the return URL. Deliberately a
 * structured log until then (Gate-1 locked decision: no email this slice).
 */
async function triggerFulfilment(sessionId: string, email: string): Promise<void> {
  console.log(
    JSON.stringify({
      source: "fulfilment",
      event: "order_paid_hook",
      session_id: sessionId,
      email,
    }),
  );
}
