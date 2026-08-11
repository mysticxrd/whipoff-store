import Image from "next/image";
import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";
import { DilutionCalc } from "@/components/home/dilution-calc";
import { VariantSelector } from "@/components/catalog/variant-selector";
import { RatingStars } from "@/components/product/rating-stars";
import { SpecAccordion } from "@/components/product/spec-accordion";
import { fromPrice } from "@/lib/catalog/select";
import type { CatalogProduct } from "@/lib/catalog/seed";

const PERKS = [
  "FREE SHIPPING ACROSS INDIA",
  "ORDERS BY 2 PM SHIP SAME DAY",
  "30-DAY RETURNS, UNOPENED",
];

/**
 * The purchase panel — design v2's SHOP section: sticky bottle visual on a
 * pine band, buy box with size chips (VariantSelector), perks, and the
 * dilution calculator. Shared by the homepage landing (id="buy",
 * `sticky={false}` CTA) and the PDP (`sticky` default, fixed bottom bar).
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
  const Heading = headingLevel;
  const price = fromPrice(product);

  return (
    <section id="buy" className="border-y border-bone/10 bg-pine px-[var(--gutter)] py-[var(--sect)]">
      <div className="mx-auto grid max-w-[1200px] gap-[clamp(36px,6vw,80px)] lg:grid-cols-2 lg:items-start">
        {/* Bottle visual — sticky alongside the buy box on desktop */}
        <Reveal className="text-center lg:sticky lg:top-[88px]">
          <div
            className="grid place-items-center rounded-lg border border-bone/10 pb-[clamp(20px,4vw,40px)] pt-[clamp(30px,6vw,60px)]"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 10%, rgba(46,158,99,0.14), transparent 60%), var(--ink)",
            }}
          >
            <div className="relative aspect-[220/460] w-[min(46vw,260px)] drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]">
              <Image
                src="/images/bottle-photo.png"
                alt={`${product.title} bottle`}
                fill
                sizes="(min-width: 1024px) 260px, 46vw"
                className="rounded-2xl object-cover"
              />
            </div>
          </div>
          <div className="mono-label mt-3.5 text-[0.62rem] text-bone/40 uppercase">
            Batch № 047 — bottled 06 / 2026
          </div>
        </Reveal>

        {/* Buy box */}
        <div>
          <Reveal>
            <Eyebrow num="05" className="mb-[clamp(18px,3vw,28px)]">
              The shop
            </Eyebrow>
          </Reveal>
          <Reveal>
            <Heading className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight">
              {product.title}
            </Heading>
          </Reveal>
          <Reveal>
            <p className="mt-2.5 text-bone/60">One formula. Three sizes. Zero excuses left.</p>
          </Reveal>

          <Reveal className="mt-[18px]">
            <RatingStars />
          </Reveal>

          <Reveal className="mt-[30px]">
            <VariantSelector productId={product.id} variants={product.variants} sticky={sticky} />
          </Reveal>

          <Reveal>
            <ul className="mono-label mt-[22px] flex flex-col gap-2 text-[0.62rem] text-bone/60">
              {PERKS.map((perk) => (
                <li key={perk}>
                  <span className="text-gold">— </span>
                  {perk}
                </li>
              ))}
            </ul>
          </Reveal>

          {price ? (
            <Reveal>
              <DilutionCalc bottleMl={518} priceMinor={price.priceCents} currency={price.currency} />
            </Reveal>
          ) : null}

          {product.description ? (
            <p className="mt-6 text-sm leading-relaxed text-bone/60">{product.description}</p>
          ) : null}

          <div className="mt-7">
            <SpecAccordion title="Ingredients & specs">
              Biodegradable surfactants, Hydroslick™ slip polymers, pH 6.5–7. 518 ml — makes up to
              ~25 washes at 1:256 dilution. Vegan, never tested on animals.
            </SpecAccordion>
            <SpecAccordion title="Shipping & returns">
              Free delivery across India on every order, dispatched same day on orders before
              2pm. 30-day returns on unopened bottles, no questions asked.
            </SpecAccordion>
          </div>
        </div>
      </div>
    </section>
  );
}
