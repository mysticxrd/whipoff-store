import "server-only";

// Catalog data access (server-only). Each function queries Supabase and FALLS BACK to the typed
// seed on error/empty — mirroring Slice 0's "prove it offline" posture so the PLP/PDP render
// locally with no live DB. All filtering/sorting/lookup is delegated to the pure helpers in
// select.ts (which enforce active-only, mirroring the public-read RLS), keeping behaviour
// identical whether the data came from Postgres or the seed.

import { createClient } from "@/lib/supabase/server";
import type { ProductListQuery } from "@/lib/contracts";
import { seedCategories, seedProducts, type CatalogProduct } from "@/lib/catalog/seed";
import {
  byPosition,
  findProductBySlug,
  selectProducts,
  type ProductListResult,
} from "@/lib/catalog/select";
import type { Category, Product, ProductImage, Variant } from "@/supabase/types";

// Shape returned by the embedded select (relationship names + nested M2M join).
type DbCatalogRow = Product & {
  product_images: ProductImage[];
  variants: Variant[];
  product_categories: { categories: Category | null }[];
};

const CATALOG_SELECT =
  "*, product_images(*), variants(*), product_categories(categories(*))";

function mapRow(row: DbCatalogRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    brand: row.brand,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images: byPosition(row.product_images ?? []),
    variants: byPosition(row.variants ?? []),
    categories: (row.product_categories ?? [])
      .map((pc) => pc.categories)
      .filter((c): c is Category => c !== null),
  };
}

/** Load the active catalog from Supabase; fall back to the typed seed when unavailable/empty. */
async function loadCatalog(): Promise<CatalogProduct[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(CATALOG_SELECT)
      .eq("status", "active")
      .returns<DbCatalogRow[]>();
    if (error || !data || data.length === 0) return seedProducts;
    return data.map(mapRow);
  } catch {
    return seedProducts;
  }
}

/** PLP: filtered/sorted/paginated active products. */
export async function listProducts(
  query: ProductListQuery,
): Promise<ProductListResult> {
  return selectProducts(await loadCatalog(), query);
}

/** PDP: a single active product by slug, or null (→ the page calls notFound()). */
export async function getProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  return findProductBySlug(await loadCatalog(), slug);
}

/** A variant joined with its parent product (cart lines need both for display + pricing). */
export type VariantWithProduct = {
  variant: Variant;
  product: CatalogProduct;
};

/**
 * Look up a single variant by id, with its parent product, for cart hydration. Searches the
 * same active catalog the PLP/PDP use (Supabase-with-seed-fallback), so pricing/availability is
 * always read live, never trusted from stored cart state (security_shield flaw #3).
 */
export async function getVariantWithProduct(
  variantId: string,
): Promise<VariantWithProduct | null> {
  const catalog = await loadCatalog();
  for (const product of catalog) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { variant, product };
  }
  return null;
}

/** Browse facets for the category filter. */
export async function listCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("position", { ascending: true });
    if (error || !data || data.length === 0) return seedCategories;
    return data;
  } catch {
    return seedCategories;
  }
}
