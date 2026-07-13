import { describe, it, expect, vi, beforeEach } from "vitest";

// server/actions/checkout.ts::verifyPayment — the Finding #2 guard, re-platformed to Razorpay.
// The action recomputes the callback HMAC (verifyPaymentSignature, which only a genuine
// Razorpay success can satisfy) and is the AUTHORITATIVE gate for emptying the shopper's cart.
// Contract under test:
//   * clears ONLY when the callback signature verifies (i.e. payment genuinely succeeded);
//   * a forged/failed callback does NOT clear — the cart survives so the shopper can retry;
//   * a malformed callback shape is rejected before the HMAC is ever computed;
//   * order state is NEVER written here (that stays the webhook's exclusive job).

const h = vi.hoisted(() => ({
  verifyPaymentSignature: vi.fn(),
  clearOwnCart: vi.fn(async () => {}),
  getCart: vi.fn(async () => ({
    lines: [],
    itemCount: 0,
    currency: "INR",
    subtotalMinor: 0,
    shippingMinor: 0,
    totalMinor: 0,
    freeShipThresholdMinor: 0,
    freeShipRemainingMinor: 0,
  })),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/razorpay", () => ({ verifyPaymentSignature: h.verifyPaymentSignature }));
vi.mock("@/lib/cart/service", () => ({
  clearOwnCart: h.clearOwnCart,
  getCart: h.getCart,
}));
// Imported by the action module (for createCheckout) but not exercised here — stub it so the
// real service (Razorpay + Supabase + server-only) is never loaded.
vi.mock("@/lib/checkout/service", () => ({ createCheckout: vi.fn() }));

import { verifyPayment } from "@/server/actions/checkout";

const CALLBACK = {
  razorpay_order_id: "order_MNabc123XYZ",
  razorpay_payment_id: "pay_MNabc123XYZ",
  razorpay_signature: "a".repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyPayment", () => {
  it("clears the cart when the callback signature verifies", async () => {
    h.verifyPaymentSignature.mockReturnValue(true);

    const result = await verifyPayment(CALLBACK);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.orderId).toBe(CALLBACK.razorpay_order_id);
    expect(h.clearOwnCart).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does NOT clear the cart when the signature fails to verify (forged callback)", async () => {
    h.verifyPaymentSignature.mockReturnValue(false);

    const result = await verifyPayment(CALLBACK);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });

  it("rejects a malformed callback before ever computing the HMAC", async () => {
    const result = await verifyPayment({ ...CALLBACK, razorpay_signature: "short" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(h.verifyPaymentSignature).not.toHaveBeenCalled();
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });

  it("rejects a callback with a bad order-id shape before the HMAC", async () => {
    const result = await verifyPayment({ ...CALLBACK, razorpay_order_id: "evil" });

    expect(result.ok).toBe(false);
    expect(h.verifyPaymentSignature).not.toHaveBeenCalled();
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });
});
