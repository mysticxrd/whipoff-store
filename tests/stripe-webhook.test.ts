import { describe, it, expect } from "vitest";
import Stripe from "stripe";

// Signature-verification semantics for app/api/webhooks/stripe/route.ts, exercised through
// the SAME SDK call the route makes (`stripe.webhooks.constructEvent`) with signatures
// minted by Stripe's own test helper. No network, no keys — the webhooks module is offline.

const SECRET = "whsec_test_secret_for_unit_tests_only";
const WRONG_SECRET = "whsec_a_completely_different_secret";

const stripe = new Stripe("sk_test_dummy_key_never_used_for_network");

const eventPayload = JSON.stringify({
  id: "evt_test_0001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_a1B2c3",
      object: "checkout.session",
      payment_status: "paid",
      amount_subtotal: 47900,
      amount_total: 52800,
      metadata: { user_id: "guest", cart_id: "guest", cart_subtotal_minor: "47900" },
    },
  },
});

function sign(payload: string, secret: string, timestamp?: number): string {
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp !== undefined ? { timestamp } : {}),
  });
}

describe("stripe webhook signature verification (constructEvent)", () => {
  it("accepts a correctly signed payload and yields the typed event", () => {
    const header = sign(eventPayload, SECRET);
    const event = stripe.webhooks.constructEvent(eventPayload, header, SECRET);
    expect(event.id).toBe("evt_test_0001");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a payload tampered with after signing (price edit)", () => {
    const header = sign(eventPayload, SECRET);
    const tampered = eventPayload.replace('"amount_total":52800', '"amount_total":1');
    expect(() => stripe.webhooks.constructEvent(tampered, header, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    );
  });

  it("rejects a signature minted with the wrong secret (forged webhook)", () => {
    const header = sign(eventPayload, WRONG_SECRET);
    expect(() => stripe.webhooks.constructEvent(eventPayload, header, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    );
  });

  it("rejects a stale timestamp outside the default tolerance (replayed capture)", () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // tolerance is 300s
    const header = sign(eventPayload, SECRET, staleTimestamp);
    expect(() => stripe.webhooks.constructEvent(eventPayload, header, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    );
  });

  it("rejects a garbage signature header outright", () => {
    expect(() =>
      stripe.webhooks.constructEvent(eventPayload, "t=0,v1=deadbeef", SECRET),
    ).toThrow(Stripe.errors.StripeSignatureVerificationError);
  });

  it("re-signing the tampered payload with the wrong secret still fails", () => {
    // The attacker can re-sign, but only with a secret they don't have.
    const tampered = eventPayload.replace('"payment_status":"paid"', '"payment_status":"x"');
    const header = sign(tampered, WRONG_SECRET);
    expect(() => stripe.webhooks.constructEvent(tampered, header, SECRET)).toThrow(
      Stripe.errors.StripeSignatureVerificationError,
    );
  });
});
