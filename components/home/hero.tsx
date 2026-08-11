import Link from "next/link";
import { BottleCanvas } from "@/components/home/bottle-canvas";
import { fromPrice } from "@/lib/catalog/select";
import { formatPrice } from "@/lib/money";
import type { CatalogProduct } from "@/lib/catalog/seed";

const CHIPS = ["pH 6.9", "1 : 256", "CERAMIC-SAFE"];

/** Masked char-rise wordmark row — server-rendered spans with staggered CSS delays. */
function TitleRow({ text, startDelay, dot }: { text: string; startDelay: number; dot?: boolean }) {
  return (
    <span className="line-mask">
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="char-rise"
          style={{ "--char-delay": `${startDelay + i * 45}ms` } as React.CSSProperties}
        >
          {ch}
        </span>
      ))}
      {dot ? (
        <span
          className="char-rise not-italic text-gold"
          style={{ "--char-delay": `${startDelay + text.length * 45}ms` } as React.CSSProperties}
        >
          .
        </span>
      ) : null}
    </span>
  );
}

/** On-load reveal for the hero's supporting copy (below-the-wordmark elements). */
function HeroFade({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <div
      className="reveal is-in"
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** Design v2 HERO — giant Fraunces wordmark, the 3D bottle overlapping it, CTAs, spec chips. */
export function Hero({ product }: { product: CatalogProduct }) {
  const price = fromPrice(product);

  return (
    <section
      id="top"
      className="relative flex min-h-svh flex-col items-center overflow-clip px-[var(--gutter)] pb-14 pt-4 lg:pb-24"
    >
      {/* emerald halo behind the bottle */}
      <div
        aria-hidden
        className="animate-halo pointer-events-none absolute left-1/2 top-[22%] aspect-square w-[min(140vw,900px)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(circle, rgba(46,158,99,0.16) 0%, rgba(46,158,99,0.05) 38%, transparent 68%)",
        }}
      />

      <p className="mono-label mb-3.5 text-center text-[0.66rem] text-gold uppercase lg:text-[0.72rem]">
        HYDROSLICK™ pH-NEUTRAL CAR SHAMPOO
      </p>

      <h1
        aria-label="Whipoff"
        data-parallax="hero-title"
        className="relative z-[1] select-none text-center font-display text-[clamp(4rem,21vw,17rem)] font-black leading-[0.8] tracking-[-0.01em] [font-variation-settings:'opsz'_144,'SOFT'_100,'WONK'_0]"
      >
        <TitleRow text="WHIP" startDelay={150} />
        <TitleRow text="OFF" startDelay={330} dot />
      </h1>

      {/* bottle overlaps the wordmark */}
      <div className="pointer-events-none relative z-[2] mt-[clamp(-120px,-7vw,-64px)] h-[clamp(260px,40svh,520px)] w-[min(88vw,460px)] lg:h-[clamp(420px,62svh,640px)] lg:w-[540px]">
        <BottleCanvas className="h-full w-full" />
        <div
          aria-hidden
          className="absolute bottom-[4%] left-1/2 h-[26px] w-3/5 -translate-x-1/2 blur-[6px]"
          style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)" }}
        />
      </div>

      <HeroFade delay={500}>
        <p className="z-[3] mt-2.5 text-center font-display text-[clamp(1.25rem,4.4vw,1.7rem)] font-normal leading-[1.35] text-bone/80 [font-variation-settings:'opsz'_40,'SOFT'_60,'WONK'_0]">
          For the ones who park far away,
          <br />
          <em className="text-gold">and look back.</em>
        </p>
      </HeroFade>

      <HeroFade delay={630}>
        <div className="z-[3] mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="#buy"
            className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-bone px-7 font-medium text-ink transition-colors hover:bg-gold"
          >
            Shop the wash{price ? ` — ${formatPrice(price.priceCents, price.currency)}` : ""}
          </Link>
          <Link
            href="#formula"
            className="inline-flex min-h-[54px] items-center justify-center rounded-full border border-bone/[0.14] bg-bone/[0.02] px-7 font-medium text-bone transition-colors hover:border-gold/55 hover:text-gold"
          >
            The formula
          </Link>
        </div>
      </HeroFade>

      <HeroFade delay={760}>
        <div aria-hidden className="mt-5 flex gap-2 text-bone/60">
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="mono-label rounded-full border border-bone/[0.14] px-3.5 py-[7px] text-[0.66rem]"
            >
              {chip}
            </span>
          ))}
        </div>
      </HeroFade>

      <div
        aria-hidden
        className="mono-label absolute bottom-[22px] left-[var(--gutter)] hidden items-center gap-3 text-[0.66rem] text-bone/40 lg:flex"
      >
        <span className="scroll-line-sweep relative h-px w-11 overflow-hidden bg-bone/[0.14]" />
        SCROLL
      </div>
    </section>
  );
}
