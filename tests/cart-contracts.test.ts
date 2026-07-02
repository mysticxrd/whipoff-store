import { describe, it, expect } from "vitest";
import {
  addCartItemSchema,
  cartQuantitySchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/lib/contracts";

const VALID_VARIANT_ID = "c0000000-0000-4000-8000-000000000101";

describe("cartQuantitySchema (strict — cart mutations reject, never degrade)", () => {
  it("accepts whole numbers in [1, 99]", () => {
    expect(cartQuantitySchema.parse(1)).toBe(1);
    expect(cartQuantitySchema.parse(99)).toBe(99);
  });

  it("coerces numeric strings (FormData input)", () => {
    expect(cartQuantitySchema.parse("5")).toBe(5);
  });

  it("rejects quantity below 1", () => {
    expect(cartQuantitySchema.safeParse(0).success).toBe(false);
  });

  it("rejects quantity above the 99 cap", () => {
    expect(cartQuantitySchema.safeParse(100).success).toBe(false);
  });

  it("rejects non-integer quantity", () => {
    expect(cartQuantitySchema.safeParse(1.5).success).toBe(false);
  });
});

describe("addCartItemSchema", () => {
  it("defaults quantity to 1 when omitted", () => {
    expect(addCartItemSchema.parse({ variantId: VALID_VARIANT_ID })).toEqual({
      variantId: VALID_VARIANT_ID,
      quantity: 1,
    });
  });

  it("rejects a malformed variantId", () => {
    expect(
      addCartItemSchema.safeParse({ variantId: "not-a-uuid", quantity: 1 }).success,
    ).toBe(false);
  });
});

describe("updateCartItemSchema", () => {
  it("requires an explicit quantity (no default)", () => {
    expect(updateCartItemSchema.safeParse({ variantId: VALID_VARIANT_ID }).success).toBe(false);
  });

  it("accepts a valid variantId + quantity", () => {
    expect(
      updateCartItemSchema.safeParse({ variantId: VALID_VARIANT_ID, quantity: 3 }).success,
    ).toBe(true);
  });
});

describe("removeCartItemSchema", () => {
  it("accepts just a variantId", () => {
    expect(removeCartItemSchema.parse({ variantId: VALID_VARIANT_ID })).toEqual({
      variantId: VALID_VARIANT_ID,
    });
  });

  it("rejects a missing variantId", () => {
    expect(removeCartItemSchema.safeParse({}).success).toBe(false);
  });
});
