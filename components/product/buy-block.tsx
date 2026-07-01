import { CatalogImage } from "@/components/catalog/catalog-image";
import { VariantSelector } from "@/components/catalog/variant-selector";
import { RatingStars } from "@/components/product/rating-stars";
import { SpecAccordion } from "@/components/product/spec-accordion";
import type { CatalogProduct } from "@/lib/catalog/seed";

const FEATURE_CHIPS = ["pH-neutral", "Ceramic-safe", "High-foam"];

/**
 * The purchase panel from the handoff's "BUY" section — product shot, rating, price/variant/
 * qty/CTA (VariantSelector), and spec accordions. Shared by the homepage landing (id="buy",
 * `sticky={false}` CTA — the page already has plenty below the fold) and the PDP (`sticky`
 * default, a fixed bottom bar — the page's only content).
 */
export function BuyBlock({
  product,
  sticky = true,
  headingLevel = "h2",
}: {
  product: CatalogProduct;
  sticky?: boolean;
  /** "h1" on the PDP (its only heading); "h2" on the homepage (Hero already owns the h1). */
  headingLevel?: "h1" | "h2";
}) {
  const primary = product.images[0];
  const Heading = headingLevel;

  return (
    <section id="buy" className="bg-white">
      <div className="mx-auto w-full max-w-xl px-5 py-14 pb-28">
        <p className="text-xs font-bold uppercase tracking-widest text-green-600">
          Add to garage
        </p>
        <Heading className="mt-3 font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {product.title}
        </Heading>

        <div className="relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-green-50 to-green-100 p-10">
          <CatalogImage
            url={primary?.url ?? `gradient:${product.slug}:0`}
            alt={primary?.alt ?? product.title}
            name={product.title}
            priority
          />
        </div>

        <div className="mt-5">
          <RatingStars />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FEATURE_CHIPS.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-6">
          <VariantSelector productId={product.id} variants={product.variants} sticky={sticky} />
        </div>

        {product.description ? (
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-2.5">
          <SpecAccordion title="Ingredients & specs">
            Biodegradable surfactants, Hydroilx™ slip polymers, pH 6.5–7. 518 ml — makes up to
            ~25 washes at 1:256 dilution. Vegan, never tested on animals.
          </SpecAccordion>
          <SpecAccordion title="Shipping & returns">
            Free delivery across India over ₹999, dispatched same day on orders before 2pm.
            30-day returns on unopened bottles, no questions asked.
          </SpecAccordion>
        </div>
      </div>
    </section>
  );
}
