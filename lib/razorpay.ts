import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getRazorpayKeySecret, getRazorpayWebhookSecret } from "@/lib/env-server";
import { clientEnv } from "@/lib/env";

// Server-side Razorpay client — a ZERO-DEPENDENCY typed fetch wrapper (the Slice-5 Resend
// precedent: one endpoint does not justify an SDK; no package to declare, pin, or typosquat —
// security_shield flaw #4 by construction). The server surface is exactly three things:
//   1. createRazorpayOrder — POST /v1/orders (basic auth key_id:key_secret);
//   2. verifyPaymentSignature — HMAC-SHA256(order_id|payment_id, key_secret), the callback gate;
//   3. verifyWebhookSignature — HMAC-SHA256(rawBody, webhook_secret), the webhook gate.
// Both verifies use timingSafeEqual — never string equality on a MAC (timing oracle).
// The key SECRET stays in this server-only module + env-server.ts; the browser sees only the
// rzp_test_ key id (clientEnv), which is publishable by design.

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string; // order_…
  amount: number; // integer minor units (paise)
  currency: string;
  receipt: string | null;
  status: string; // created | attempted | paid
};

/**
 * Create a Razorpay Order for the given SERVER-COMPUTED amount. `receipt` is our
 * checkout_sessions row id (uuid, ≤40 chars — Razorpay's cap) so dashboard rows map back to
 * staging rows; `notes` carry ids for dashboard reconciliation ONLY (the cart snapshot lives
 * in checkout_sessions — notes cannot round-trip a cart; 01_data migration header).
 * Throws on non-2xx with a status-only error (no response-body echo into logs/Sentry).
 */
export async function createRazorpayOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keyId = clientEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    throw new Error("Razorpay is not configured (NEXT_PUBLIC_RAZORPAY_KEY_ID missing)");
  }
  const auth = Buffer.from(`${keyId}:${getRazorpayKeySecret()}`).toString("base64");

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    // Status only — Razorpay error bodies can echo request details; keep them out of logs.
    throw new Error(`Razorpay order creation failed (HTTP ${response.status})`);
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { id?: unknown }).id !== "string" ||
    typeof (body as { amount?: unknown }).amount !== "number"
  ) {
    throw new Error("Razorpay order creation returned an unexpected shape");
  }
  const order = body as RazorpayOrder;
  if (order.amount !== input.amountMinor) {
    // Paranoia over money: the provider echoing a different amount is a hard stop.
    throw new Error("Razorpay order amount mismatch at creation");
  }
  return order;
}

/** Constant-time hex-MAC comparison; false on any shape mismatch instead of throwing. */
function safeHexEqual(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length === 0 || expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * The checkout-callback gate: proves the (order_id, payment_id) pair was issued by Razorpay
 * for OUR key. HMAC-SHA256 over `order_id|payment_id` with the key secret, per Razorpay's
 * verification contract. Inputs must already be Zod-parsed (razorpayCallbackSchema).
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = createHmac("sha256", getRazorpayKeySecret())
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeHexEqual(expected, input.signature);
}

/**
 * The webhook gate: x-razorpay-signature is HMAC-SHA256 over the EXACT raw body bytes with
 * the webhook secret (payments.md: verify before any parse/use; reject unverified).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", getRazorpayWebhookSecret())
    .update(rawBody)
    .digest("hex");
  return safeHexEqual(expected, signature);
}
