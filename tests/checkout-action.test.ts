import { describe, it, expect, vi, beforeEach } from "vitest";

// Finding #2 — server/actions/checkout.ts::clearCartAfterCheckout.
// The action re-fetches the session from Stripe (client can't lie) and is the AUTHORITATIVE
// gate for emptying the shopper's cart. Contract under test:
//   * clears ONLY when the session is complete AND paid (payment_status paid / no_payment_required);
//   * a completed-but-unpaid async session (may still async_payment_failed) does NOT clear —
//     the cart survives so the shopper can retry (the Finding #2 regression);
//   * open / expired sessions and Stripe errors never clear;
//   * a malformed session id is rejected before Stripe is ever called.
// "is-paid" is decided by the real deriveOrderStatus (unmocked) — the same helper the webhook
// order-write uses — so this test also pins that the two decisions share one definition.

const h = vi.hoisted(() => ({
  retrieve: vi.fn(),
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
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: h.retrieve } } }),
}));
vi.mock("@/lib/cart/service", () => ({
  clearOwnCart: h.clearOwnCart,
  getCart: h.getCart,
}));
// Imported by the action module (for createCheckoutSession) but not exercised here — stub it so
// the real service (Stripe + server-only) is never loaded.
vi.mock("@/lib/checkout/service", () => ({ createEmbeddedCheckoutSession: vi.fn() }));

import { clearCartAfterCheckout } from "@/server/actions/checkout";

const SESSION_ID = "cs_test_a1B2c3D4e5F6g7H8i9J0";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clearCartAfterCheckout", () => {
  it("clears the cart when the session is complete and paid", async () => {
    h.retrieve.mockResolvedValue({ status: "complete", payment_status: "paid" });

    const result = await clearCartAfterCheckout({ sessionId: SESSION_ID });

    expect(result.ok).toBe(true);
    expect(h.clearOwnCart).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("clears when payment_status is no_payment_required (zero-value order still counts as paid)", async () => {
    h.retrieve.mockResolvedValue({ status: "complete", payment_status: "no_payment_required" });

    const result = await clearCartAfterCheckout({ sessionId: SESSION_ID });

    expect(result.ok).toBe(true);
    expect(h.clearOwnCart).toHaveBeenCalledTimes(1);
  });

  it("does NOT clear a completed-but-unpaid async session — the Finding #2 guard", async () => {
    // Async method (e.g. bank debit): status=complete, payment still confirming. It may later
    // async_payment_failed, so clearing here would destroy a cart the shopper still needs.
    h.retrieve.mockResolvedValue({ status: "complete", payment_status: "unpaid" });

    const result = await clearCartAfterCheckout({ sessionId: SESSION_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });

  it("does NOT clear an open (still-payable) session", async () => {
    h.retrieve.mockResolvedValue({ status: "open", payment_status: "unpaid" });

    const result = await clearCartAfterCheckout({ sessionId: SESSION_ID });

    expect(result.ok).toBe(false);
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });

  it("fails safe (no clear) when Stripe retrieve throws", async () => {
    h.retrieve.mockRejectedValue(new Error("stripe unreachable"));

    const result = await clearCartAfterCheckout({ sessionId: SESSION_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unknown");
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });

  it("rejects a malformed session id before ever calling Stripe", async () => {
    const result = await clearCartAfterCheckout({ sessionId: "evil" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.clearOwnCart).not.toHaveBeenCalled();
  });
});
