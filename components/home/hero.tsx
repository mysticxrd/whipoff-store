import Link from "next/link";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { RatingStars } from "@/components/product/rating-stars";
import { fromPrice } from "@/lib/catalog/select";
import { formatPrice, formatWasPrice, LAUNCH_SALE_ACTIVE } from "@/lib/money";
import type { CatalogProduct } from "@/lib/catalog/seed";

const STATS = [
  { value: "518", unit: "ml", label: "per bottle" },
  { value: "~25", unit: "", label: "washes" },
  { value: "6.5–7", unit: "", label: "neutral pH" },
  { value: "1:256", unit: "", label: "dilution" },
];

const FEATURE_CHIPS = ["pH-neutral", "Ceramic-safe", "High-foam"];

/** The handoff's HERO section — brand statement, floating bottle, price, stat grid. */
export function Hero({ product }: { product: CatalogProduct }) {
  const price = fromPrice(product);
  const bottle = product.images[1] ?? product.images[0];

  return (
    <section id="top" className="relative overflow-hidden bg-green-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[22%] -top-[12%] size-[540px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(46,129,89,.5), rgba(46,129,89,0) 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-[34vw] font-black leading-[0.8] tracking-tighter text-white/[0.035]"
      >
        OFF.
      </div>

      <div className="relative mx-auto max-w-xl px-5 pb-13 pt-11">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-green-400">
          Hydroilx™ · pH-Neutral Car Shampoo
        </p>
        <h1 className="font-display text-[clamp(3.1rem,17vw,5.6rem)] font-black leading-[0.9] tracking-tighter text-white">
          Whip it
          <br />
          off<span className="text-green-500">.</span>
        </h1>
        <p className="mt-4 max-w-[35ch] text-lg leading-snug text-green-200">
          The slick, high-foam gloss wash that lifts a fortnight of road film — and leaves
          your wax and ceramic dead untouched.
        </p>

        <div className="mt-4">
          <RatingStars tone="dark" />
        </div>

        <div className="my-2 flex justify-center py-3">
          <div className="relative h-[min(46vh,420px)] w-[210px]">
            {bottle ? (
              <CatalogImage
                url={bottle.url}
                alt={bottle.alt ?? product.title}
                name={product.title}
                className="animate-float object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.38)]"
              />
            ) : null}
          </div>
        </div>

        {price ? (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-black text-white">
                {formatPrice(price.priceCents, price.currency)}
              </span>
              {LAUNCH_SALE_ACTIVE ? (
                <span className="text-base text-green-400 line-through">
                  {formatWasPrice(price.priceCents, price.currency)}
                </span>
              ) : null}
            </div>
            {LAUNCH_SALE_ACTIVE ? (
              <span className="inline-flex items-center rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">
                Save 20%
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href="#buy"
            className="inline-flex min-h-[54px] min-w-40 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-bold text-green-950 transition-colors hover:bg-green-100"
          >
            Shop now
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FEATURE_CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-green-100"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-white/10 pt-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-2xl font-black leading-none text-white">
                {stat.value}
                {stat.unit ? <span className="text-sm font-bold text-green-400"> {stat.unit}</span> : null}
              </div>
              <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-green-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
