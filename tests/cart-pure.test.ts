import { describe, it, expect } from "vitest";
import { buildCartView, clampQuantity, parseGuestCartLines } from "@/lib/cart/pure";
import type { CartLineView } from "@/lib/cart/pure";

const VARIANT_A = "c0000000-0000-4000-8000-000000000101";
const VARIANT_B = "c0000000-0000-4000-8000-000000000102";

function line(overrides: Partial<CartLineView> = {}): CartLineView {
  return {
    variantId: VARIANT_A,
    productId: "b0000000-0000-4000-8000-000000000001",
    productSlug: "whipoff-gloss-wash",
    productTitle: "Whipoff Gloss Wash",
    variantTitle: "500 ml",
    imageUrl: "gradient:whipoff-gloss-wash:0",
    quantity: 1,
    unitPriceMinor: 47000,
    lineTotalMinor: 47000,
    currency: "INR",
    inStock: true,
    ...overrides,
  };
}

describe("clampQuantity", () => {
  it("clamps below 1 up to 1", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
  });

  it("clamps above the per-line cap down to 99", () => {
    expect(clampQuantity(500)).toBe(99);
  });

  it("truncates fractional input", () => {
    expect(clampQuantity(3.9)).toBe(3);
  });

  it("passes through valid values unchanged", () => {
    expect(clampQuantity(42)).toBe(42);
  });
});

describe("parseGuestCartLines (lenient — drops bad lines instead of throwing)", () => {
  it("returns an empty array for non-array input", () => {
    expect(parseGuestCartLines(null)).toEqual([]);
    expect(parseGuestCartLines({ variantId: VARIANT_A, quantity: 1 })).toEqual([]);
    expect(parseGuestCartLines("not json")).toEqual([]);
  });

  it("accepts well-formed lines and clamps quantity", () => {
    expect(
      parseGuestCartLines([
        { variantId: VARIANT_A, quantity: 2 },
        { variantId: VARIANT_B, quantity: 500 },
      ]),
    ).toEqual([
      { variantId: VARIANT_A, quantity: 2 },
      { variantId: VARIANT_B, quantity: 99 },
    ]);
  });

  it("drops entries with an invalid (non-uuid) variantId", () => {
    expect(parseGuestCartLines([{ variantId: "not-a-uuid", quantity: 1 }])).toEqual([]);
  });

  it("drops entries with a non-numeric quantity", () => {
    expect(parseGuestCartLines([{ variantId: VARIANT_A, quantity: "abc" }])).toEqual([]);
  });

  it("de-duplicates repeated variant ids, keeping the first", () => {
    expect(
      parseGuestCartLines([
        { variantId: VARIANT_A, quantity: 1 },
        { variantId: VARIANT_A, quantity: 5 },
      ]),
    ).toEqual([{ variantId: VARIANT_A, quantity: 1 }]);
  });
});

describe("buildCartView", () => {
  it("returns a zeroed view for an empty cart (no shipping charged)", () => {
    const view = buildCartView([]);
    expect(view.itemCount).toBe(0);
    expect(view.subtotalMinor).toBe(0);
    expect(view.shippingMinor).toBe(0);
    expect(view.totalMinor).toBe(0);
  });

  it("sums quantities and line totals across lines", () => {
    const view = buildCartView([
      line({ quantity: 2, lineTotalMinor: 94000 }),
      line({ variantId: VARIANT_B, quantity: 1, unitPriceMinor: 79900, lineTotalMinor: 79900 }),
    ]);
    expect(view.itemCount).toBe(3);
    expect(view.subtotalMinor).toBe(173900);
  });

  it("charges zero shipping below the legacy free-shipping threshold", () => {
    const view = buildCartView([line({ quantity: 1, lineTotalMinor: 47000 })]);
    expect(view.subtotalMinor).toBeLessThan(view.freeShipThresholdMinor);
    expect(view.shippingMinor).toBe(0);
    expect(view.totalMinor).toBe(view.subtotalMinor);
  });

  it("keeps shipping free at/above the legacy free-shipping threshold", () => {
    const view = buildCartView([
      line({ quantity: 3, unitPriceMinor: 47000, lineTotalMinor: 141000 }),
    ]);
    expect(view.subtotalMinor).toBeGreaterThanOrEqual(view.freeShipThresholdMinor);
    expect(view.shippingMinor).toBe(0);
    expect(view.freeShipRemainingMinor).toBe(0);
  });
});
