import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
} from "@/lib/env-server";

// Server-side Razorpay client — a ZERO-DEPENDENCY typed fetch wrapper. The server surface is
// exactly three things: Orders API + the callback and webhook HMAC gates. Both verifies use
// timingSafeEqual. The publishable key is deployment-validated by getRazorpayKeyId(); its
// paired secrets remain server-only and use distinct test/live environment variable names.

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export async function createRazorpayOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  // Re-check at the provider-call boundary; even a future caller that skips checkout/service
  // cannot use a live key in Preview or a test key in Production.
  const keyId = getRazorpayKeyId();
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

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", getRazorpayWebhookSecret())
    .update(rawBody)
    .digest("hex");
  return safeHexEqual(expected, signature);
}
