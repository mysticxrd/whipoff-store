import { describe, it, expect } from "vitest";
import { seedProducts } from "@/lib/catalog/seed";
import {
  findProductBySlug,
  fromPrice,
  selectProducts,
} from "@/lib/catalog/select";
import type { ProductListQuery } from "@/lib/contracts";

const q = (over: Partial<ProductListQuery> = {}): ProductListQuery => ({
  category: undefined,
  sort: "newest",
  page: 1,
  ...over,
});

describe("selectProducts", () => {
  it("returns only active products (the draft is hidden — mirrors RLS)", () => {
    const result = selectProducts(seedProducts, q());
    expect(result.total).toBe(7);
    expect(result.items.every((p) => p.status === "active")).toBe(true);
    expect(result.items.some((p) => p.slug === "prototype-glass-sealant")).toBe(false);
  });

  it("sorts newest first by created_at", () => {
    const items = selectProducts(seedProducts, q({ sort: "newest" })).items;
    expect(items[0]?.slug).toBe("ceramic-spray-wax");
    expect(items[items.length - 1]?.slug).toBe("wheel-cleaner");
  });

  it("sorts by ascending 'from' price", () => {
    const items = selectProducts(seedProducts, q({ sort: "price_asc" })).items;
    expect(items[0]?.slug).toBe("microfiber-wash-mitt"); // ₹449 — cheapest
  });

  it("sorts by descending 'from' price", () => {
    const items = selectProducts(seedProducts, q({ sort: "price_desc" })).items;
    expect(items[0]?.slug).toBe("ceramic-spray-wax"); // ₹1,299 — priciest entry point
  });

  it("filters to a single category", () => {
    const result = selectProducts(seedProducts, q({ category: "exterior" }));
    expect(result.total).toBe(3);
    expect(result.items.map((p) => p.slug).sort()).toEqual(
      ["ceramic-spray-wax", "microfiber-wash-mitt", "snow-foam-shampoo"].sort(),
    );
  });

  it("clamps an out-of-range page to the last available page", () => {
    const result = selectProducts(seedProducts, q({ page: 99 }));
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.items.length).toBe(7);
  });
});

describe("findProductBySlug", () => {
  it("finds an active product", () => {
    expect(findProductBySlug(seedProducts, "ceramic-spray-wax")?.title).toBe(
      "Ceramic Spray Wax",
    );
  });

  it("returns null for a draft product (active-only)", () => {
    expect(findProductBySlug(seedProducts, "prototype-glass-sealant")).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(findProductBySlug(seedProducts, "does-not-exist")).toBeNull();
  });
});

describe("fromPrice", () => {
  it("returns the cheapest variant's price + currency", () => {
    const product = findProductBySlug(seedProducts, "ceramic-spray-wax");
    expect(fromPrice(product!)).toEqual({ priceCents: 129900, currency: "INR" });
  });
});
