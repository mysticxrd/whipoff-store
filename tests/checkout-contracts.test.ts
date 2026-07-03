import { describe, it, expect } from "vitest";
import {
  checkoutReturnQuerySchema,
  checkoutSessionIdSchema,
  checkoutSessionMetadataSchema,
  clearCartAfterCheckoutSchema,
  orderStatusSchema,
} from "@/lib/contracts";

const USER_ID = "a0000000-0000-4000-8000-000000000001";
const CART_ID = "d0000000-0000-4000-8000-000000000001";

describe("checkoutSessionIdSchema", () => {
  it("accepts test- and live-mode session ids", () => {
    expect(checkoutSessionIdSchema.safeParse("cs_test_a1B2c3").success).toBe(true);
    expect(checkoutSessionIdSchema.safeParse("cs_live_Zz9").success).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["wrong prefix", "pi_test_a1B2c3"],
    ["missing mode", "cs_a1B2c3"],
    ["unknown mode", "cs_prod_a1B2c3"],
    ["trailing garbage", "cs_test_abc?><"],
    ["path traversal", "cs_test_../../etc"],
    ["whitespace", "cs_test_abc def"],
    ["over length cap", `cs_test_${"a".repeat(200)}`],
  ])("rejects %s", (_name, value) => {
    expect(checkoutSessionIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("checkoutReturnQuerySchema", () => {
  it("parses a valid session_id param", () => {
    expect(
      checkoutReturnQuerySchema.safeParse({ session_id: "cs_test_abc123" }).success,
    ).toBe(true);
  });

  it("rejects missing or malformed params", () => {
    expect(checkoutReturnQuerySchema.safeParse({}).success).toBe(false);
    expect(checkoutReturnQuerySchema.safeParse({ session_id: "junk" }).success).toBe(false);
    expect(checkoutReturnQuerySchema.safeParse({ session_id: 42 }).success).toBe(false);
  });
});

describe("clearCartAfterCheckoutSchema", () => {
  it("accepts a valid sessionId and rejects everything else", () => {
    expect(clearCartAfterCheckoutSchema.safeParse({ sessionId: "cs_test_ok1" }).success).toBe(
      true,
    );
    expect(clearCartAfterCheckoutSchema.safeParse({ sessionId: "evil" }).success).toBe(false);
    expect(clearCartAfterCheckoutSchema.safeParse({}).success).toBe(false);
  });
});

describe("checkoutSessionMetadataSchema (Stripe round-trip contract)", () => {
  it("round-trips the guest path", () => {
    const parsed = checkoutSessionMetadataSchema.parse({
      user_id: "guest",
      cart_id: "guest",
      cart_subtotal_minor: "47900",
    });
    expect(parsed).toEqual({
      user_id: "guest",
      cart_id: "guest",
      cart_subtotal_minor: 47900, // coerced from Stripe's string metadata
    });
  });

  it("round-trips real uuids", () => {
    const parsed = checkoutSessionMetadataSchema.parse({
      user_id: USER_ID,
      cart_id: CART_ID,
      cart_subtotal_minor: "0",
    });
    expect(parsed.user_id).toBe(USER_ID);
    expect(parsed.cart_id).toBe(CART_ID);
    expect(parsed.cart_subtotal_minor).toBe(0);
  });

  it.each([
    ["non-uuid user_id", { user_id: "admin", cart_id: "guest", cart_subtotal_minor: "1" }],
    ["missing cart_id", { user_id: "guest", cart_subtotal_minor: "1" }],
    [
      "negative subtotal",
      { user_id: "guest", cart_id: "guest", cart_subtotal_minor: "-1" },
    ],
    [
      "fractional subtotal",
      { user_id: "guest", cart_id: "guest", cart_subtotal_minor: "12.5" },
    ],
    [
      "non-numeric subtotal",
      { user_id: "guest", cart_id: "guest", cart_subtotal_minor: "lots" },
    ],
    ["empty object", {}],
  ])("rejects %s", (_name, value) => {
    expect(checkoutSessionMetadataSchema.safeParse(value).success).toBe(false);
  });
});

describe("orderStatusSchema", () => {
  it("accepts exactly the five lifecycle states", () => {
    for (const status of ["pending", "paid", "fulfilled", "refunded", "cancelled"]) {
      expect(orderStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(orderStatusSchema.safeParse("shipped").success).toBe(false);
    expect(orderStatusSchema.safeParse("PAID").success).toBe(false);
  });
});
