import { describe, it, expect } from "vitest";
import {
  buildLineItemsFromCart,
  buildSessionMetadata,
  buildShippingOption,
  deriveOrderStatus,
  findUnavailableLines,
  mapSessionToOrderPayload,
} from "@/lib/checkout/pure";
import type {
  CheckoutLine,
  WebhookLineItemShape,
  WebhookSessionShape,
} from "@/lib/checkout/pure";
import { FLAT_SHIP_FEE_MINOR, FREE_SHIP_THRESHOLD_MINOR } from "@/lib/money";

const VARIANT_A = "c0000000-0000-4000-8000-000000000101";
const VARIANT_B = "c0000000-0000-4000-8000-000000000102";
const USER_ID = "a0000000-0000-4000-8000-000000000001";
const CART_ID = "d0000000-0000-4000-8000-000000000001";

function checkoutLine(overrides: Partial<CheckoutLine> = {}): CheckoutLine {
  return {
    variantId: VARIANT_A,
    productId: "b0000000-0000-4000-8000-000000000001",
    productSlug: "whipoff-gloss-wash",
    productTitle: "Whipoff Gloss Wash",
    variantTitle: "500 ml",
    imageUrl: "gradient:whipoff-gloss-wash:0",
    quantity: 1,
    unitPriceMinor: 47900,
    lineTotalMinor: 47900,
    currency: "INR",
    inStock: true,
    sku: "WGW-500",
    inventoryCount: 10,
    ...overrides,
  };
}

function session(overrides: Partial<WebhookSessionShape> = {}): WebhookSessionShape {
  return {
    id: "cs_test_a1B2c3D4e5F6g7H8i9J0",
    payment_status: "paid",
    currency: "inr",
    amount_subtotal: 47900,
    amount_total: 52800,
    total_details: { amount_tax: 0, amount_shipping: 4900 },
    customer_details: { email: "buyer@example.com", name: "Card Holder" },
    collected_information: {
      shipping_details: {
        name: "Ship To",
        address: { line1: "1 MG Road", city: "Bengaluru", country: "IN" },
      },
    },
    payment_intent: "pi_test_123",
    metadata: {
      user_id: "guest",
      cart_id: "guest",
      cart_subtotal_minor: "47900",
    },
    ...overrides,
  };
}

function lineItem(overrides: Partial<WebhookLineItemShape> = {}): WebhookLineItemShape {
  return {
    quantity: 1,
    amount_total: 47900,
    price: {
      unit_amount: 47900,
      product: {
        name: "Whipoff Gloss Wash — 500 ml",
        metadata: {
          variant_id: VARIANT_A,
          product_title: "Whipoff Gloss Wash",
          variant_title: "500 ml",
          sku: "WGW-500",
        },
      },
    },
    ...overrides,
  };
}

describe("findUnavailableLines", () => {
  it("passes lines whose quantity fits live stock", () => {
    expect(findUnavailableLines([checkoutLine({ quantity: 10, inventoryCount: 10 })])).toEqual(
      [],
    );
  });

  it("blocks a line whose quantity exceeds live stock", () => {
    const over = checkoutLine({ quantity: 3, inventoryCount: 2 });
    expect(findUnavailableLines([checkoutLine(), over])).toEqual([over]);
  });

  it("blocks any quantity against zero stock", () => {
    const out = checkoutLine({ quantity: 1, inventoryCount: 0 });
    expect(findUnavailableLines([out])).toEqual([out]);
  });
});

describe("buildLineItemsFromCart", () => {
  it("prices each line from the live variant in lowercase minor units", () => {
    const item = buildLineItemsFromCart([checkoutLine()])[0]!;
    expect(item.quantity).toBe(1);
    expect(item.price_data.currency).toBe("inr");
    expect(item.price_data.unit_amount).toBe(47900);
    expect(item.price_data.product_data.name).toBe("Whipoff Gloss Wash — 500 ml");
  });

  it("stamps variant identity into per-line product metadata", () => {
    const item = buildLineItemsFromCart([checkoutLine()])[0]!;
    expect(item.price_data.product_data.metadata).toEqual({
      variant_id: VARIANT_A,
      product_title: "Whipoff Gloss Wash",
      variant_title: "500 ml",
      sku: "WGW-500",
    });
  });

  it("omits the sku key when the variant has none", () => {
    const item = buildLineItemsFromCart([checkoutLine({ sku: null })])[0]!;
    expect("sku" in item.price_data.product_data.metadata).toBe(false);
  });
});

describe("buildShippingOption", () => {
  it("mirrors computeShippingMinor below the threshold (flat ₹49)", () => {
    const option = buildShippingOption(FREE_SHIP_THRESHOLD_MINOR - 1, "INR");
    expect(option.shipping_rate_data.fixed_amount.amount).toBe(FLAT_SHIP_FEE_MINOR);
    expect(option.shipping_rate_data.fixed_amount.currency).toBe("inr");
    expect(option.shipping_rate_data.display_name).toBe("Standard shipping");
    expect(option.shipping_rate_data.type).toBe("fixed_amount");
  });

  it("mirrors computeShippingMinor at/above the threshold (free)", () => {
    const option = buildShippingOption(FREE_SHIP_THRESHOLD_MINOR, "INR");
    expect(option.shipping_rate_data.fixed_amount.amount).toBe(0);
    expect(option.shipping_rate_data.display_name).toBe("Free shipping");
  });
});

describe("buildSessionMetadata", () => {
  it("marks the signed-out path as guest on both ids", () => {
    expect(buildSessionMetadata({ userId: null, cartId: null, subtotalMinor: 47900 })).toEqual({
      user_id: "guest",
      cart_id: "guest",
      cart_subtotal_minor: "47900",
    });
  });

  it("carries real ids and stringifies the subtotal", () => {
    const metadata = buildSessionMetadata({
      userId: USER_ID,
      cartId: CART_ID,
      subtotalMinor: 0,
    });
    expect(metadata).toEqual({
      user_id: USER_ID,
      cart_id: CART_ID,
      cart_subtotal_minor: "0",
    });
  });
});

describe("deriveOrderStatus", () => {
  it("maps paid and no_payment_required to paid", () => {
    expect(deriveOrderStatus("paid")).toBe("paid");
    expect(deriveOrderStatus("no_payment_required")).toBe("paid");
  });

  it("maps unpaid (async method still processing) to pending", () => {
    expect(deriveOrderStatus("unpaid")).toBe("pending");
  });
});

describe("mapSessionToOrderPayload", () => {
  it("maps a paid guest session to RPC payloads off Stripe's amounts", () => {
    const result = mapSessionToOrderPayload(session(), [lineItem()]);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order).toEqual({
      user_id: null,
      email: "buyer@example.com",
      status: "paid",
      currency: "INR",
      amount_subtotal_minor: 47900,
      amount_shipping_minor: 4900,
      amount_tax_minor: 0,
      amount_total_minor: 52800,
      stripe_checkout_session_id: "cs_test_a1B2c3D4e5F6g7H8i9J0",
      stripe_payment_intent_id: "pi_test_123",
      shipping_name: "Ship To",
      shipping_address: { line1: "1 MG Road", city: "Bengaluru", country: "IN" },
    });
    expect(result.items).toEqual([
      {
        variant_id: VARIANT_A,
        product_title: "Whipoff Gloss Wash",
        variant_title: "500 ml",
        sku: "WGW-500",
        unit_price_minor: 47900,
        quantity: 1,
        line_total_minor: 47900,
        currency: "INR",
      },
    ]);
    expect(result.userId).toBeNull();
    expect(result.cartId).toBeNull();
    expect(result.subtotalMismatch).toBe(false);
  });

  it("resolves real user/cart ids from metadata", () => {
    const result = mapSessionToOrderPayload(
      session({
        metadata: { user_id: USER_ID, cart_id: CART_ID, cart_subtotal_minor: "47900" },
      }),
      [lineItem()],
    );
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order.user_id).toBe(USER_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.cartId).toBe(CART_ID);
  });

  it("defaults tax/shipping to 0 when total_details is absent (tax-fallback session)", () => {
    const result = mapSessionToOrderPayload(session({ total_details: null }), [lineItem()]);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order.amount_tax_minor).toBe(0);
    expect(result.order.amount_shipping_minor).toBe(0);
  });

  it("writes an unpaid completed session as pending", () => {
    const result = mapSessionToOrderPayload(session({ payment_status: "unpaid" }), [
      lineItem(),
    ]);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order.status).toBe("pending");
  });

  it("flags (never corrects) a subtotal mismatch vs the creation snapshot", () => {
    const result = mapSessionToOrderPayload(
      session({
        metadata: { user_id: "guest", cart_id: "guest", cart_subtotal_minor: "1" },
      }),
      [lineItem()],
    );
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.subtotalMismatch).toBe(true);
    expect(result.order.amount_subtotal_minor).toBe(47900);
  });

  it("expands a payment_intent object to its id", () => {
    const result = mapSessionToOrderPayload(
      session({ payment_intent: { id: "pi_object_form" } }),
      [lineItem()],
    );
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order.stripe_payment_intent_id).toBe("pi_object_form");
  });

  it("falls back to customer name when no shipping name was collected", () => {
    const result = mapSessionToOrderPayload(session({ collected_information: null }), [
      lineItem(),
    ]);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.order.shipping_name).toBe("Card Holder");
    expect(result.order.shipping_address).toBeNull();
  });

  it("maps multiple line items preserving per-line snapshots", () => {
    const result = mapSessionToOrderPayload(
      session({ amount_subtotal: 95800, amount_total: 100700 }),
      [
        lineItem(),
        lineItem({
          quantity: 2,
          amount_total: 95800,
          price: {
            unit_amount: 47900,
            product: {
              metadata: { variant_id: VARIANT_B, product_title: "Whipoff Gloss Wash" },
            },
          },
        }),
      ],
    );
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({
      variant_id: VARIANT_B,
      variant_title: "Standard", // missing snapshot key falls back
      sku: null,
      line_total_minor: 95800,
    });
  });

  it("derives line_total from unit_amount × quantity when amount_total is absent", () => {
    const result = mapSessionToOrderPayload(session(), [
      lineItem({ quantity: 3, amount_total: null }),
    ]);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.items[0]!.line_total_minor).toBe(47900 * 3);
  });

  // -- permanent failures (webhook 200s + alerts; retries can't heal these) --

  it.each([
    ["missing metadata", session({ metadata: null }), [lineItem()]],
    [
      "malformed metadata",
      session({ metadata: { user_id: "not-a-uuid", cart_id: "guest" } }),
      [lineItem()],
    ],
  ])("rejects %s as invalid_session_metadata", (_name, s, items) => {
    expect(mapSessionToOrderPayload(s, items)).toEqual({
      ok: false,
      reason: "invalid_session_metadata",
    });
  });

  it("rejects a session without a customer email", () => {
    expect(
      mapSessionToOrderPayload(session({ customer_details: { email: null } }), [lineItem()]),
    ).toEqual({ ok: false, reason: "missing_customer_email" });
  });

  it("rejects a session missing authoritative amounts", () => {
    expect(mapSessionToOrderPayload(session({ amount_total: null }), [lineItem()])).toEqual({
      ok: false,
      reason: "missing_session_amounts",
    });
  });

  it("rejects an empty line-item list", () => {
    expect(mapSessionToOrderPayload(session(), [])).toEqual({
      ok: false,
      reason: "no_line_items",
    });
  });

  it("rejects a line whose product metadata lacks a valid variant_id", () => {
    const noVariant = lineItem({
      price: { unit_amount: 47900, product: { metadata: { product_title: "X" } } },
    });
    expect(mapSessionToOrderPayload(session(), [noVariant])).toEqual({
      ok: false,
      reason: "missing_variant_id",
    });
  });

  it("rejects an unexpanded (string) product — deleted/lean payloads can't be trusted", () => {
    const stringProduct = lineItem({
      price: { unit_amount: 47900, product: "prod_unexpanded" },
    });
    expect(mapSessionToOrderPayload(session(), [stringProduct])).toEqual({
      ok: false,
      reason: "missing_variant_id",
    });
  });

  it("rejects invalid quantities and missing unit amounts", () => {
    expect(mapSessionToOrderPayload(session(), [lineItem({ quantity: 0 })])).toEqual({
      ok: false,
      reason: "invalid_line_quantity",
    });
    expect(
      mapSessionToOrderPayload(session(), [
        lineItem({
          quantity: 1,
          price: { unit_amount: null, product: lineItem().price!.product },
        }),
      ]),
    ).toEqual({ ok: false, reason: "missing_unit_amount" });
  });
});
