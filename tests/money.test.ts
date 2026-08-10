import { describe, it, expect } from "vitest";
import {
  computeShippingMinor,
  formatPrice,
  formatPriceFrom,
  formatPriceRange,
  FREE_SHIP_THRESHOLD_MINOR,
  FLAT_SHIP_FEE_MINOR,
} from "@/lib/money";

describe("formatPrice (INR, en-IN)", () => {
  it("formats whole amounts without decimals", () => {
    expect(formatPrice(44900, "INR")).toBe("₹449");
    expect(formatPrice(129900, "INR")).toBe("₹1,299");
  });

  it("uses Indian digit grouping for large amounts", () => {
    // 10,000,000 paise = ₹1,00,000 (lakh grouping).
    expect(formatPrice(10000000, "INR")).toBe("₹1,00,000");
  });

  it("keeps two decimals when there is a fractional part", () => {
    expect(formatPrice(129950, "INR")).toBe("₹1,299.50");
  });
});

describe("formatPriceFrom", () => {
  it("prefixes 'from'", () => {
    expect(formatPriceFrom(44900, "INR")).toBe("from ₹449");
  });
});

describe("formatPriceRange", () => {
  it("collapses to a single price when min === max", () => {
    expect(formatPriceRange(44900, 44900, "INR")).toBe("₹449");
  });

  it("renders a span when min !== max", () => {
    expect(formatPriceRange(44900, 129900, "INR")).toBe("₹449 – ₹1,299");
  });
});

describe("computeShippingMinor (always-free shipping)", () => {
  it("returns zero below the legacy threshold when the flat fee is waived", () => {
    expect(FLAT_SHIP_FEE_MINOR).toBe(0);
    expect(computeShippingMinor(0)).toBe(0);
    expect(computeShippingMinor(FREE_SHIP_THRESHOLD_MINOR - 1)).toBe(0);
  });

  it("returns zero at or above the legacy threshold", () => {
    expect(computeShippingMinor(FREE_SHIP_THRESHOLD_MINOR)).toBe(0);
    expect(computeShippingMinor(FREE_SHIP_THRESHOLD_MINOR + 1)).toBe(0);
  });
});
