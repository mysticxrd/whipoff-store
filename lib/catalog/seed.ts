// Typed in-repo seed catalog (INR) — the LOCAL data source for Slice 1.
//
// Why this exists: there is no live Supabase in this box (local-first). The query layer
// (queries.ts) tries Supabase first and falls back to this typed seed when offline/empty,
// so the PLP/PDP are fully verifiable now. This file mirrors store/supabase/seed.sql exactly
// (same deterministic UUIDs, slugs, prices) so swapping to the real DB is seamless.
//
// Image `url`s are placeholder tokens ("gradient:<slug>:<pos>"); the UI renders a CSS gradient
// instead of loading a file (see stages/02_build/output/build_notes.md). The seed intentionally
// includes ONE draft product to prove active-only filtering in the pure select layer.

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
const P2 = "b0000000-0000-4000-8000-000000000002";
const P3 = "b0000000-0000-4000-8000-000000000003";
const P4 = "b0000000-0000-4000-8000-000000000004";
const P5 = "b0000000-0000-4000-8000-000000000005";
const P6 = "b0000000-0000-4000-8000-000000000006";
const P7 = "b0000000-0000-4000-8000-000000000007";
const P8 = "b0000000-0000-4000-8000-000000000008";

/** All seed products, active and draft. Consumers must filter to active themselves. */
export const seedProducts: CatalogProduct[] = [
  product(
    {
      id: P1,
      slug: "ceramic-spray-wax",
      title: "Ceramic Spray Wax",
      description:
        "A spray-on SiO2 ceramic top coat for fast gloss and water beading between full details.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-20T10:00:00Z",
      categorySlugs: ["exterior"],
    },
    [
      image("d0000000-0000-4000-8000-000000000101", P1, "ceramic-spray-wax", 0, "Ceramic Spray Wax bottle, front", "2026-06-20T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000102", P1, "ceramic-spray-wax", 1, "Ceramic Spray Wax bottle, back", "2026-06-20T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000101", P1, "WO-CSW-500", "500 ml", 129900, 25, 0, "2026-06-20T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000102", P1, "WO-CSW-1000", "1 L", 219900, 12, 1, "2026-06-20T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P2,
      slug: "snow-foam-shampoo",
      title: "Snow Foam Shampoo",
      description:
        "High-foaming pre-wash that lifts grime safely before contact washing.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-19T10:00:00Z",
      categorySlugs: ["exterior"],
    },
    [
      image("d0000000-0000-4000-8000-000000000201", P2, "snow-foam-shampoo", 0, "Snow Foam Shampoo bottle, front", "2026-06-19T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000202", P2, "snow-foam-shampoo", 1, "Snow Foam Shampoo bottle, back", "2026-06-19T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000201", P2, "WO-SFS-1000", "1 L", 69900, 40, 0, "2026-06-19T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000202", P2, "WO-SFS-5000", "5 L", 249900, 8, 1, "2026-06-19T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P3,
      slug: "microfiber-wash-mitt",
      title: "Microfiber Wash Mitt",
      description:
        "Plush, deep-pile mitt that traps dirt away from paint to avoid swirl marks.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-18T10:00:00Z",
      categorySlugs: ["exterior"],
    },
    [
      image("d0000000-0000-4000-8000-000000000301", P3, "microfiber-wash-mitt", 0, "Microfiber Wash Mitt", "2026-06-18T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000301", P3, "WO-MWM-OS", "One size", 44900, 100, 0, "2026-06-18T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P4,
      slug: "leather-conditioner",
      title: "Leather Conditioner",
      description:
        "pH-balanced conditioner that nourishes and protects leather seats and trim.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-17T10:00:00Z",
      categorySlugs: ["interior"],
    },
    [
      image("d0000000-0000-4000-8000-000000000401", P4, "leather-conditioner", 0, "Leather Conditioner bottle, front", "2026-06-17T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000402", P4, "leather-conditioner", 1, "Leather Conditioner bottle, back", "2026-06-17T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000401", P4, "WO-LC-250", "250 ml", 89900, 30, 0, "2026-06-17T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000402", P4, "WO-LC-500", "500 ml", 149900, 15, 1, "2026-06-17T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P5,
      slug: "dashboard-detailer",
      title: "Dashboard Detailer",
      description:
        "Anti-static interior dressing for dashboards and plastics, matte or gloss finish.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-16T10:00:00Z",
      categorySlugs: ["interior"],
    },
    [
      image("d0000000-0000-4000-8000-000000000501", P5, "dashboard-detailer", 0, "Dashboard Detailer bottle, front", "2026-06-16T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000502", P5, "dashboard-detailer", 1, "Dashboard Detailer bottle, back", "2026-06-16T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000501", P5, "WO-DD-MATTE", "Matte 500 ml", 59900, 20, 0, "2026-06-16T10:00:00Z"),
      variant("c0000000-0000-4000-8000-000000000502", P5, "WO-DD-GLOSS", "Gloss 500 ml", 59900, 18, 1, "2026-06-16T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P6,
      slug: "tyre-shine-gel",
      title: "Tyre Shine Gel",
      description: "Long-lasting gel dressing for a deep satin-to-gloss tyre finish.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-15T10:00:00Z",
      categorySlugs: ["wheels-tyres"],
    },
    [
      image("d0000000-0000-4000-8000-000000000601", P6, "tyre-shine-gel", 0, "Tyre Shine Gel tub, front", "2026-06-15T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000602", P6, "tyre-shine-gel", 1, "Tyre Shine Gel tub, back", "2026-06-15T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000601", P6, "WO-TSG-500", "500 ml", 74900, 22, 0, "2026-06-15T10:00:00Z"),
      // Out of stock — drives the "out of stock" availability indicator on the PDP.
      variant("c0000000-0000-4000-8000-000000000602", P6, "WO-TSG-1000", "1 L", 129900, 0, 1, "2026-06-15T10:00:00Z"),
    ],
  ),
  product(
    {
      id: P7,
      slug: "wheel-cleaner",
      title: "Wheel Cleaner",
      description:
        "Colour-changing acid-free cleaner that dissolves brake dust on all wheel finishes.",
      brand: "Whipoff",
      status: "active",
      createdAt: "2026-06-14T10:00:00Z",
      categorySlugs: ["wheels-tyres"],
    },
    [
      image("d0000000-0000-4000-8000-000000000701", P7, "wheel-cleaner", 0, "Wheel Cleaner bottle, front", "2026-06-14T10:00:00Z"),
      image("d0000000-0000-4000-8000-000000000702", P7, "wheel-cleaner", 1, "Wheel Cleaner bottle, back", "2026-06-14T10:00:00Z"),
    ],
    [
      variant("c0000000-0000-4000-8000-000000000701", P7, "WO-WC-500", "500 ml", 84900, 17, 0, "2026-06-14T10:00:00Z"),
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
