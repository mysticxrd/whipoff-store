// Pure catalog selection logic — filter / sort / paginate / lookup.
//
// Deliberately has NO "server-only" import and NO I/O: it operates on an in-memory array so it
// is unit-testable without a database (queries.ts wires it to Supabase + the seed fallback).
// It also MIRRORS the RLS posture: only `status === "active"` products are ever returned, just
// like the public-read policy. The seed fallback isn't governed by RLS, so this is what keeps
// draft/archived products from leaking locally.

import type { ProductListQuery, ProductSort } from "@/lib/contracts";
import type { CatalogProduct } from "@/lib/catalog/seed";
import type { Variant } from "@/supabase/types";

/** Items per PLP page. Small catalog → effectively one page, but pagination is real. */
export const PAGE_SIZE = 12;

export type ProductListResult = {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** The cheapest variant's price for a product (the "from" price), or null if no variants. */
export function fromPrice(
  product: CatalogProduct,
): { priceCents: number; currency: string } | null {
  let cheapest: Variant | null = null;
  for (const v of product.variants) {
    if (!cheapest || v.price_cents < cheapest.price_cents) cheapest = v;
  }
  return cheapest
    ? { priceCents: cheapest.price_cents, currency: cheapest.currency }
    : null;
}

function priceSortKey(product: CatalogProduct): number {
  const from = fromPrice(product);
  return from ? from.priceCents : Number.POSITIVE_INFINITY;
}

function compare(a: CatalogProduct, b: CatalogProduct, sort: ProductSort): number {
  if (sort === "price_asc") {
    const d = priceSortKey(a) - priceSortKey(b);
    if (d !== 0) return d;
  } else if (sort === "price_desc") {
    const d = priceSortKey(b) - priceSortKey(a);
    if (d !== 0) return d;
  }
  // Default + tie-break: newest first by created_at, then id for a stable order.
  const t = Date.parse(b.created_at) - Date.parse(a.created_at);
  if (t !== 0) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Filter (active-only, optional category), sort, and paginate the catalog. */
export function selectProducts(
  products: CatalogProduct[],
  query: ProductListQuery,
): ProductListResult {
  const active = products.filter((p) => p.status === "active");
  const filtered = query.category
    ? active.filter((p) => p.categories.some((c) => c.slug === query.category))
    : active;

  const sorted = [...filtered].sort((a, b) => compare(a, b, query.sort));

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const items = sorted.slice(start, start + PAGE_SIZE);

  return { items, total, page, pageSize: PAGE_SIZE, pageCount };
}

/** Find a single active product by slug (active-only, mirroring RLS), or null. */
export function findProductBySlug(
  products: CatalogProduct[],
  slug: string,
): CatalogProduct | null {
  return products.find((p) => p.status === "active" && p.slug === slug) ?? null;
}

/** Order a product's variants/images by their stored position (ascending). */
export function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}
