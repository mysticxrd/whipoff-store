import { describe, it, expect } from "vitest";
import { seedProducts, type CatalogProduct } from "@/lib/catalog/seed";
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

// Minimal literal fixtures (not the real seed) — the sort comparator is generic and should be
// proven with >1 active item, independent of how many real products the catalog happens to carry.
function fixture(over: {
  id: string;
  slug: string;
  createdAt: string;
  priceCents: number;
  categorySlugs?: string[];
}): CatalogProduct {
  return {
    id: over.id,
    slug: over.slug,
    title: over.slug,
    description: null,
    brand: "Whipoff",
    status: "active",
    created_at: over.createdAt,
    updated_at: over.createdAt,
    images: [],
    variants: [
      {
        id: `${over.id}-v1`,
        product_id: over.id,
        sku: over.slug,
        title: "Default",
        price_cents: over.priceCents,
        currency: "INR",
        inventory_count: 10,
        position: 0,
        created_at: over.createdAt,
        updated_at: over.createdAt,
      },
    ],
    categories: (over.categorySlugs ?? []).map((slug) => ({
      id: `cat-${slug}`,
      slug,
      name: slug,
      description: null,
      position: 0,
      created_at: over.createdAt,
      updated_at: over.createdAt,
    })),
  };
}

const sortFixtures: CatalogProduct[] = [
  fixture({ id: "f1", slug: "mid", createdAt: "2026-06-15T10:00:00Z", priceCents: 50000 }),
  fixture({ id: "f2", slug: "newest", createdAt: "2026-06-20T10:00:00Z", priceCents: 90000 }),
  fixture({ id: "f3", slug: "cheapest", createdAt: "2026-06-10T10:00:00Z", priceCents: 10000 }),
];

describe("selectProducts", () => {
  it("returns only active products (the draft is hidden — mirrors RLS)", () => {
    const result = selectProducts(seedProducts, q());
    expect(result.total).toBe(1);
    expect(result.items.every((p) => p.status === "active")).toBe(true);
    expect(result.items.some((p) => p.slug === "prototype-glass-sealant")).toBe(false);
    expect(result.items[0]?.slug).toBe("whipoff-gloss-wash");
  });

  it("sorts newest first by created_at", () => {
    const items = selectProducts(sortFixtures, q({ sort: "newest" })).items;
    expect(items[0]?.slug).toBe("newest");
    expect(items[items.length - 1]?.slug).toBe("cheapest");
  });

  it("sorts by ascending 'from' price", () => {
    const items = selectProducts(sortFixtures, q({ sort: "price_asc" })).items;
    expect(items[0]?.slug).toBe("cheapest");
    expect(items[items.length - 1]?.slug).toBe("newest");
  });

  it("sorts by descending 'from' price", () => {
    const items = selectProducts(sortFixtures, q({ sort: "price_desc" })).items;
    expect(items[0]?.slug).toBe("newest");
    expect(items[items.length - 1]?.slug).toBe("cheapest");
  });

  it("filters to a single category", () => {
    const result = selectProducts(seedProducts, q({ category: "exterior" }));
    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe("whipoff-gloss-wash");
  });

  it("returns nothing for a category the active product isn't in", () => {
    const result = selectProducts(seedProducts, q({ category: "interior" }));
    expect(result.total).toBe(0);
  });

  it("clamps an out-of-range page to the last available page", () => {
    const result = selectProducts(seedProducts, q({ page: 99 }));
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.items.length).toBe(1);
  });
});

describe("findProductBySlug", () => {
  it("finds an active product", () => {
    expect(findProductBySlug(seedProducts, "whipoff-gloss-wash")?.title).toBe(
      "Whipoff Gloss Wash",
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
    const product = findProductBySlug(seedProducts, "whipoff-gloss-wash");
    expect(fromPrice(product!)).toEqual({ priceCents: 47000, currency: "INR" });
  });
});
