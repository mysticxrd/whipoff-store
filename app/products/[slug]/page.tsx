import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productSlugSchema } from "@/lib/contracts";
import { getProductBySlug } from "@/lib/catalog/queries";
import { fromPrice } from "@/lib/catalog/select";
import { ProductViewTracker } from "@/components/catalog/product-view-tracker";
import { BuyBlock } from "@/components/product/buy-block";

type PageProps = { params: Promise<{ slug: string }> };

// PDP = the handoff's "BUY" section (design-map.md: single-product IA). The slug is validated
// STRICTLY (productSlugSchema): a malformed slug can match no product, so the page 404s rather
// than rendering an error. Only active products are returned (mirrors the public-read RLS) —
// draft/archived slugs 404 too.
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
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-xl px-5 pt-5">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to shop
        </Link>
      </div>

      <BuyBlock product={product} headingLevel="h1" />

      <ProductViewTracker
        productId={product.id}
        slug={product.slug}
        valueMinor={price?.priceCents ?? 0}
        currency={price?.currency ?? "INR"}
      />
    </main>
  );
}
