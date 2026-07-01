import { ProductCard } from "@/components/catalog/product-card";
import type { CatalogProduct } from "@/lib/catalog/seed";

/** Mobile-first responsive grid: 1 col on phones, 2 at sm, 3 at lg. */
export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No products match this filter yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
