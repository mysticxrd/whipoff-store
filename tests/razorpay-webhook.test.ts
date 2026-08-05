import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

const KEY_SECRET = "rzp_key_secret_for_unit_tests_only";
const WEBHOOK_SECRET = "rzp_webhook_secret_for_unit_tests_only";
const WRONG_SECRET = "a_completely_different_secret_value";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env-server", () => ({
  getRazorpayKeyId: () => "rzp_test_x",
  getRazorpayKeySecret: () => KEY_SECRET,
  getRazorpayWebhookSecret: () => WEBHOOK_SECRET,
}));

import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/razorpay";

const ORDER_ID = "order_MNabc123XYZ";
const PAYMENT_ID = "pay_MNabc123XYZ";

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

describe("verifyPaymentSignature (checkout callback gate)", () => {
  it("accepts the signature Razorpay mints over order_id|payment_id", () => {
    const signature = hmac(KEY_SECRET, `${ORDER_ID}|${PAYMENT_ID}`);
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature })).toBe(
      true,
    );
  });

  it("rejects a signature minted with a secret the attacker doesn't have", () => {
    const forged = hmac(WRONG_SECRET, `${ORDER_ID}|${PAYMENT_ID}`);
    expect(
      verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: forged }),
    ).toBe(false);
  });

  it("rejects a payment id swapped in after signing (bind order↔payment)", () => {
    const signature = hmac(KEY_SECRET, `${ORDER_ID}|${PAYMENT_ID}`);
    expect(
      verifyPaymentSignature({
        orderId: ORDER_ID,
        paymentId: "pay_someone_elses",
        signature,
      }),
    ).toBe(false);
  });

  it("rejects a malformed (non-hex / wrong-length) signature without throwing", () => {
    expect(
      verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: "nope" }),
    ).toBe(false);
    expect(
      verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: "" }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature (webhook raw-body gate)", () => {
  const rawBody = JSON.stringify({
    event: "order.paid",
    payload: { payment: { entity: { id: PAYMENT_ID, order_id: ORDER_ID, amount: 52800 } } },
  });

  it("accepts the signature over the exact raw body bytes", () => {
    expect(verifyWebhookSignature(rawBody, hmac(WEBHOOK_SECRET, rawBody))).toBe(true);
  });

  it("rejects a body tampered with after signing (amount edit)", () => {
    const signature = hmac(WEBHOOK_SECRET, rawBody);
    const tampered = rawBody.replace('"amount":52800', '"amount":1');
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a signature minted with the wrong webhook secret (forged event)", () => {
    expect(verifyWebhookSignature(rawBody, hmac(WRONG_SECRET, rawBody))).toBe(false);
  });

  it("rejects a garbage signature header outright", () => {
    expect(verifyWebhookSignature(rawBody, "deadbeef")).toBe(false);
  });
});
