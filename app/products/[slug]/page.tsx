import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productSlugSchema } from "@/lib/contracts";
import { getProductBySlug } from "@/lib/catalog/queries";
import { fromPrice } from "@/lib/catalog/select";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductViewTracker } from "@/components/catalog/product-view-tracker";
import { VariantSelector } from "@/components/catalog/variant-selector";
import { Badge } from "@/components/ui/badge";

type PageProps = { params: Promise<{ slug: string }> };

// PDP. The slug is validated STRICTLY (productSlugSchema): a malformed slug can match no product,
// so the page 404s rather than rendering an error. Only active products are returned (mirrors the
// public-read RLS) — draft/archived slugs 404 too.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = productSlugSchema.safeParse({ slug });
  // notFound() here (not a "Not found" title) so Next sets the 404 status BEFORE the response
  // head streams — returning metadata commits a 200 and degrades the page to a soft 404.
  if (!parsed.success) notFound();

  const product = await getProductBySlug(parsed.data.slug);
  if (!product) notFound();

  return {
    title: `${product.title} · Whipoff`,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const parsed = productSlugSchema.safeParse({ slug });
  if (!parsed.success) notFound();

  const product = await getProductBySlug(parsed.data.slug);
  if (!product) notFound();

  const price = fromPrice(product);

  return (
    // pb-28 keeps content clear of the fixed bottom add-to-cart bar.
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-28">
      <Link
        href="/products"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to shop
      </Link>

      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <ProductGallery images={product.images} productName={product.title} />

        <div className="flex flex-col gap-4">
          <div>
            {product.brand ? (
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {product.brand}
              </span>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {product.title}
            </h1>
          </div>

          <VariantSelector productId={product.id} variants={product.variants} />

          {product.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          {product.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {product.categories.map((category) => (
                <Link key={category.id} href={`/products?category=${category.slug}`}>
                  <Badge variant="muted">{category.name}</Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ProductViewTracker
        productId={product.id}
        slug={product.slug}
        valueMinor={price?.priceCents ?? 0}
        currency={price?.currency ?? "INR"}
      />
    </main>
  );
}
