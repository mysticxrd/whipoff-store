import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  assertRazorpayOrderCredentialsConfigured: vi.fn(),
  getCart: vi.fn(),
  createAdminClient: vi.fn(),
  createRazorpayOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/env-server", () => ({
  assertRazorpayOrderCredentialsConfigured: h.assertRazorpayOrderCredentialsConfigured,
}));
vi.mock("@/lib/cart/service", () => ({
  getCart: h.getCart,
  getCartOwner: vi.fn(),
}));
vi.mock("@/lib/catalog/queries", () => ({ getVariantWithProduct: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: h.createAdminClient }));
vi.mock("@/lib/razorpay", () => ({ createRazorpayOrder: h.createRazorpayOrder }));

import { createCheckout } from "@/lib/checkout/service";

const INPUT = {
  email: "shopper@example.test",
  shipping: {
    name: "Shreya Singh",
    line1: "12 Market Road",
    city: "Pune",
    state: "Maharashtra",
    postal_code: "411001",
    country: "IN" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCheckout credential preflight", () => {
  it("does not read the cart, stage PII, or call Razorpay when the selected secret is invalid", async () => {
    h.assertRazorpayOrderCredentialsConfigured.mockImplementation(() => {
      throw new Error("Missing/invalid server env RAZORPAY_LIVE_KEY_SECRET");
    });

    const result = await createCheckout(INPUT);

    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(h.getCart).not.toHaveBeenCalled();
    expect(h.createAdminClient).not.toHaveBeenCalled();
    expect(h.createRazorpayOrder).not.toHaveBeenCalled();
  });
});
