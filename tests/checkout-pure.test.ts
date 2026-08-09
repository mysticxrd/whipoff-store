import { describe, it, expect } from "vitest";
import {
  buildItemsSnapshot,
  buildOrderNotes,
  computeCheckoutAmounts,
  findUnavailableLines,
} from "@/lib/checkout/pure";
import type { CheckoutLine } from "@/lib/checkout/pure";
import { FLAT_SHIP_FEE_MINOR, FREE_SHIP_THRESHOLD_MINOR } from "@/lib/money";

const VARIANT_A = "c0000000-0000-4000-8000-000000000101";
const VARIANT_B = "c0000000-0000-4000-8000-000000000102";
const USER_ID = "a0000000-0000-4000-8000-000000000001";
const CART_ID = "d0000000-0000-4000-8000-000000000001";
const CS_ID = "e0000000-0000-4000-8000-000000000001";

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

describe("computeCheckoutAmounts", () => {
  it("charges flat shipping below the free-ship threshold with zero tax (GST-inclusive)", () => {
    const amounts = computeCheckoutAmounts([
      checkoutLine({ unitPriceMinor: 47900, lineTotalMinor: 47900 }),
    ]);
    expect(amounts).toEqual({
      subtotalMinor: 47900,
      shippingMinor: FLAT_SHIP_FEE_MINOR,
      taxMinor: 0,
      totalMinor: 47900 + FLAT_SHIP_FEE_MINOR,
    });
  });

  it("waives shipping at/above the free-ship threshold", () => {
    const amounts = computeCheckoutAmounts([
      checkoutLine({ quantity: 3, unitPriceMinor: 40000, lineTotalMinor: 120000 }),
    ]);
    expect(amounts.subtotalMinor).toBe(120000);
    expect(amounts.shippingMinor).toBe(0);
    expect(amounts.totalMinor).toBe(120000);
    expect(amounts.subtotalMinor).toBeGreaterThanOrEqual(FREE_SHIP_THRESHOLD_MINOR);
  });

  it("sums multiple lines from their line totals (never re-derived from client input)", () => {
    const amounts = computeCheckoutAmounts([
      checkoutLine({ lineTotalMinor: 47900 }),
      checkoutLine({ variantId: VARIANT_B, quantity: 2, lineTotalMinor: 95800 }),
    ]);
    expect(amounts.subtotalMinor).toBe(143700);
    expect(amounts.shippingMinor).toBe(0);
    expect(amounts.totalMinor).toBe(143700);
  });
});

describe("buildItemsSnapshot", () => {
  it("mirrors the order_items columns verbatim (record_paid_order copies these through)", () => {
    const snapshot = buildItemsSnapshot([checkoutLine()]);
    expect(snapshot).toEqual([
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
  });

  it("carries a null sku through and upcases the currency", () => {
    const snapshot = buildItemsSnapshot([checkoutLine({ sku: null, currency: "inr" })]);
    expect(snapshot[0]!.sku).toBeNull();
    expect(snapshot[0]!.currency).toBe("INR");
  });
});

describe("buildOrderNotes", () => {
  it("marks the signed-out path as guest on both ids", () => {
    expect(
      buildOrderNotes({ checkoutSessionId: CS_ID, userId: null, cartId: null }),
    ).toEqual({ checkout_session_id: CS_ID, user_id: "guest", cart_id: "guest" });
  });

  it("carries real ids for the signed-in path", () => {
    expect(
      buildOrderNotes({ checkoutSessionId: CS_ID, userId: USER_ID, cartId: CART_ID }),
    ).toEqual({ checkout_session_id: CS_ID, user_id: USER_ID, cart_id: CART_ID });
  });
});
