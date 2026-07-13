import { describe, it, expect } from "vitest";
import {
  checkoutReturnQuerySchema,
  createCheckoutSchema,
  orderStatusSchema,
  providerOrderIdSchema,
  providerPaymentIdSchema,
  razorpayCallbackSchema,
  razorpayWebhookEventSchema,
  shippingDetailsSchema,
} from "@/lib/contracts";

const ORDER_ID = "order_MNabc123XYZ";
const PAYMENT_ID = "pay_MNabc123XYZ";
const SIG = "a".repeat(64);

describe("providerOrderIdSchema / providerPaymentIdSchema", () => {
  it("accepts Razorpay's order_/pay_ id shapes", () => {
    expect(providerOrderIdSchema.safeParse(ORDER_ID).success).toBe(true);
    expect(providerPaymentIdSchema.safeParse(PAYMENT_ID).success).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["wrong prefix", "pay_abc"], // for order schema
    ["missing prefix", "MNabc123"],
    ["path traversal", "order_../../etc"],
    ["whitespace", "order_ab cd"],
    ["over length cap", `order_${"a".repeat(64)}`],
  ])("order schema rejects %s", (_name, value) => {
    expect(providerOrderIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("shippingDetailsSchema", () => {
  const base = {
    name: "Ada Lovelace",
    line1: "1 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    country: "IN",
  };

  it("parses a valid India address and defaults country to IN", () => {
    const parsed = shippingDetailsSchema.parse({ ...base, country: undefined });
    expect(parsed.country).toBe("IN");
    expect(parsed.postal_code).toBe("560001");
  });

  it("accepts an optional 10-digit mobile and optional line2", () => {
    expect(
      shippingDetailsSchema.safeParse({ ...base, line2: "Flat 2", phone: "9876543210" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["leading-zero PIN", { ...base, postal_code: "060001" }],
    ["short PIN", { ...base, postal_code: "5600" }],
    ["non-India country", { ...base, country: "US" }],
    ["mobile starting below 6", { ...base, phone: "5876543210" }],
    ["mobile with +91", { ...base, phone: "+919876543210" }],
    ["empty name", { ...base, name: "" }],
  ])("rejects %s", (_name, value) => {
    expect(shippingDetailsSchema.safeParse(value).success).toBe(false);
  });
});

describe("createCheckoutSchema", () => {
  const shipping = {
    name: "Ada",
    line1: "1 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    country: "IN",
  };

  it("lowercases and trims the email", () => {
    const parsed = createCheckoutSchema.parse({
      email: "  Buyer@Example.COM ",
      shipping,
    });
    expect(parsed.email).toBe("buyer@example.com");
  });

  it("rejects a malformed email and a missing shipping block", () => {
    expect(createCheckoutSchema.safeParse({ email: "nope", shipping }).success).toBe(false);
    expect(createCheckoutSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
  });
});

describe("razorpayCallbackSchema", () => {
  it("accepts a well-formed signed callback", () => {
    expect(
      razorpayCallbackSchema.safeParse({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: SIG,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["short signature", { razorpay_signature: "abc" }],
    ["uppercase-hex signature", { razorpay_signature: "A".repeat(64) }],
    ["bad order id", { razorpay_order_id: "nope" }],
  ])("rejects %s", (_name, patch) => {
    expect(
      razorpayCallbackSchema.safeParse({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: SIG,
        ...patch,
      }).success,
    ).toBe(false);
  });
});

describe("checkoutReturnQuerySchema", () => {
  it("parses a valid order_id param", () => {
    expect(checkoutReturnQuerySchema.safeParse({ order_id: ORDER_ID }).success).toBe(true);
  });

  it("rejects missing or malformed params", () => {
    expect(checkoutReturnQuerySchema.safeParse({}).success).toBe(false);
    expect(checkoutReturnQuerySchema.safeParse({ order_id: "junk" }).success).toBe(false);
    expect(checkoutReturnQuerySchema.safeParse({ order_id: 42 }).success).toBe(false);
  });
});

describe("razorpayWebhookEventSchema", () => {
  function evt(event: string, amount: number) {
    return {
      event,
      payload: {
        payment: {
          entity: { id: PAYMENT_ID, order_id: ORDER_ID, amount, status: "captured" },
        },
      },
    };
  }

  it("parses the three subscribed events with an integer paise amount", () => {
    for (const type of ["order.paid", "payment.captured", "payment.failed"]) {
      expect(razorpayWebhookEventSchema.safeParse(evt(type, 52800)).success).toBe(true);
    }
  });

  it.each([
    ["unsubscribed event", evt("payment.authorized", 52800)],
    ["fractional amount", evt("order.paid", 52800.5)],
    ["negative amount", evt("order.paid", -1)],
    ["missing entity", { event: "order.paid", payload: { payment: {} } }],
  ])("rejects %s", (_name, value) => {
    expect(razorpayWebhookEventSchema.safeParse(value).success).toBe(false);
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
