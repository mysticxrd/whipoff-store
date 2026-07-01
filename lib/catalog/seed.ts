// Typed in-repo seed catalog (INR) — the LOCAL data source for Slice 1.
//
// Why this exists: there is no live Supabase in this box (local-first). The query layer
// (queries.ts) tries Supabase first and falls back to this typed seed when offline/empty,
// so the PLP/PDP are fully verifiable now. This file mirrors store/supabase/seed.sql exactly
// (same deterministic UUIDs, slugs, prices) so swapping to the real DB is seamless.
//
// Aligned to the Claude Design handoff (2026-07-01): the store is a single-product DTC
// landing (Whipoff Gloss Wash), so the catalog carries that one real, active product. Its
// gallery uses real files in `public/` (not the gradient placeholder). A second, unrelated
// DRAFT product is kept so active-only filtering stays proven in the pure select layer.

import type {
  Category,
  Product,
  ProductImage,
  ProductStatus,
  Variant,
} from "@/supabase/types";

/** A product joined with its gallery, variants, and categories (the shape the UI consumes). */
export type CatalogProduct = Product & {
  images: ProductImage[];
  variants: Variant[];
  categories: Category[];
};

const CAT_TS = "2026-06-10T10:00:00Z";

export const seedCategories: Category[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    slug: "exterior",
    name: "Exterior Care",
    description: "Washes, waxes and sealants for paintwork.",
    position: 0,
    created_at: CAT_TS,
    updated_at: CAT_TS,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    slug: "interior",
    name: "Interior Care",
    description: "Cabin, leather and trim detailing.",
    position: 1,
    created_at: CAT_TS,
    updated_at: CAT_TS,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    slug: "wheels-tyres",
    name: "Wheels & Tyres",
    description: "Wheel cleaners and tyre dressings.",
    position: 2,
    created_at: CAT_TS,
    updated_at: CAT_TS,
  },
];

const bySlug = (slug: string): Category => {
  const c = seedCategories.find((x) => x.slug === slug);
  if (!c) throw new Error(`seed: unknown category slug "${slug}"`);
  return c;
};

// --- small row builders (keep the seed terse but fully typed) ---
function variant(
  id: string,
  productId: string,
  sku: string,
  title: string,
  priceCents: number,
  inventory: number,
  position: number,
  createdAt: string,
): Variant {
  return {
    id,
    product_id: productId,
    sku,
    title,
    price_cents: priceCents,
    currency: "INR",
    inventory_count: inventory,
    position,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function image(
  id: string,
  productId: string,
  slug: string,
  position: number,
  alt: string,
  createdAt: string,
): ProductImage {
  return {
    id,
    product_id: productId,
    url: `gradient:${slug}:${position}`,
    alt,
    position,
    created_at: createdAt,
  };
}

function product(
  base: {
    id: string;
    slug: string;
    title: string;
    description: string;
    brand: string;
    status: ProductStatus;
    createdAt: string;
    categorySlugs: string[];
  },
  images: ProductImage[],
  variants: Variant[],
): CatalogProduct {
  return {
    id: base.id,
    slug: base.slug,
    title: base.title,
    description: base.description,
    brand: base.brand,
    status: base.status,
    created_at: base.createdAt,
    updated_at: base.createdAt,
    images,
    variants,
    categories: base.categorySlugs.map(bySlug),
  };
}

const P1 = "b0000000-0000-4000-8000-000000000001";
const P8 = "b0000000-0000-4000-8000-000000000008";

// Real image paths (not "gradient:" tokens) — served from public/, rendered via next/image
// (CatalogImage picks the real-photo branch whenever a url doesn't start with "gradient:").
function realImage(
  id: string,
  productId: string,
  url: string,
  position: number,
  alt: string,
  createdAt: string,
): ProductImage {
  return { id, product_id: productId, url, alt, position, created_at: createdAt };
}

/** All seed products, active and draft. Consumers must filter to active themselves. */
export const seedProducts: CatalogProduct[] = [
  product(
    {
      id: P1,
      slug: "whipoff-gloss-wash",
      title: "Whipoff Gloss Wash",
      description:
        "The slick, high-foam Hydroilx™ gloss wash that lifts a fortnight of road film — and leaves your wax and ceramic dead untouched.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-20T10:00:00Z",
      categorySlugs: ["exterior"],
    },
    [
      realImage("d0000000-0000-4000-8000-000000000101", P1, "/whipoff-product.png", 0, "Whipoff Gloss Wash box and bottle", "2026-06-20T10:00:00Z"),
      realImage("d0000000-0000-4000-8000-000000000102", P1, "/whipoff-bottle-cutout.png", 1, "Whipoff Gloss Wash bottle", "2026-06-20T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000101", P1, "WO-GW-500", "500 ml", 47900, 60, 0, "2026-06-20T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000102", P1, "WO-GW-1000", "1 L", 79900, 40, 1, "2026-06-20T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000103", P1, "WO-GW-2000", "2 L", 143900, 20, 2, "2026-06-20T10:00:00Z"),
    ],
  ),
  // DRAFT — must never reach the PLP/PDP for the public (active-only filtering proof).
  product(
    {
      id: P8,
      slug: "prototype-glass-sealant",
      title: "Prototype Glass Sealant",
      description: "Unreleased hydrophobic glass coating — internal testing only.",
      brand: "Whipoff",
      status: "draft",
      createdAt: "2026-06-13T10:00:00Z",
      categorySlugs: ["wheels-tyres"],
    },
    [
      image("d0000000-0000-4000-8000-000000000801", P8, "prototype-glass-sealant", 0, "Prototype Glass Sealant bottle", "2026-06-13T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000801", P8, "WO-PGS-500", "500 ml", 99900, 5, 0, "2026-06-13T10:00:00Z"),
    ],
  ),
];
