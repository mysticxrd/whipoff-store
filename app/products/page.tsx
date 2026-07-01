import type { Metadata } from "next";
import { Suspense } from "react";
import { productListQuerySchema } from "@/lib/contracts";
import { listCategories, listProducts } from "@/lib/catalog/queries";
import { CategoryFilter } from "@/components/catalog/category-filter";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";
import { ProductListTracker } from "@/components/catalog/product-list-tracker";
import { SortSelect } from "@/components/catalog/sort-select";

export const metadata: Metadata = {
  title: "Shop all · Whipoff",
  description: "Browse Whipoff car-care products — exterior, interior, wheels and tyres.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// PLP. The loading skeleton streams from an INNER <Suspense> rather than a route-level
// `loading.tsx`. A `loading.tsx` here creates a Suspense boundary over the whole /products
// subtree — including /products/[slug] — so the PDP would flush a 200 shell before its
// notFound() runs, degrading real 404s into soft 404s. Scoping the boundary to the PLP body
// keeps the skeleton while letting the sibling PDP return a true 404.
export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Shop all</h1>
      </header>

      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// searchParams cross a trust boundary → parsed & re-validated server-side with the shared Zod
// contract (security_shield.md flaw #3). The contract is LENIENT (`.catch` fallbacks): an unknown
// ?sort=/?category= degrades to the default rather than erroring, so the grid always renders
// (AC#2). Kept in a child so its async data work suspends INSIDE the boundary above.
async function ProductResults({ searchParams }: PageProps) {
  const query = productListQuerySchema.parse(await searchParams);
  const [list, categories] = await Promise.all([
    listProducts(query),
    listCategories(),
  ]);

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        {list.total} {list.total === 1 ? "product" : "products"}
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter
          categories={categories}
          activeCategory={query.category ?? null}
          sort={query.sort}
        />
        <div className="shrink-0">
          <SortSelect sort={query.sort} />
        </div>
      </div>

      <ProductGrid products={list.items} />

      <ProductListTracker
        category={query.category ?? null}
        sort={query.sort}
        count={list.total}
      />
    </>
  );
}
