import Link from "next/link";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { fromPrice } from "@/lib/catalog/select";
import { formatPrice, formatPriceFrom } from "@/lib/money";
import type { CatalogProduct } from "@/lib/catalog/seed";

/** PLP grid cell. Whole card is the tap target → /products/<slug>. */
export function ProductCard({ product }: { product: CatalogProduct }) {
  const primary = product.images[0];
  const price = fromPrice(product);
  const multiVariant = product.variants.length > 1;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-green-50">
        <CatalogImage
          url={primary?.url ?? `gradient:${product.slug}:0`}
          alt={primary?.alt ?? product.title}
          name={product.title}
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
        ) : null}
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {product.title}
        </h3>
        {price ? (
          <p className="mt-auto pt-1 text-sm font-semibold text-foreground">
            {multiVariant
              ? formatPriceFrom(price.priceCents, price.currency)
              : formatPrice(price.priceCents, price.currency)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
