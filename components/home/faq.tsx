import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";

const ITEMS = [
  {
    q: "Will it strip my ceramic coating or wax?",
    a: (
      <>
        No. At pH 6.9 the formula is dead-neutral — it lifts film and grime without touching
        cured coatings, sealants, or wax. It’s the shampoo detailers use <em>between</em>{" "}
        maintenance washes.
      </>
    ),
  },
  {
    q: "How much do I actually use?",
    a: (
      <>
        1:256 — about 19 ml in a 5 L bucket. The cap doubles as a measure. A 500 ml bottle is
        roughly 26 washes; the 2 L is a season and a half.
      </>
    ),
  },
  {
    q: "Does it work in a foam cannon?",
    a: (
      <>
        Beautifully. Run 1:10 in the canister and it throws a dense, slow-collapsing blanket.
        Rinse-safe on glass and trim.
      </>
    ),
  },
  {
    q: "Shipping & returns?",
    a: (
      <>
        Free shipping across India over ₹999. Orders before 2 PM IST ship the same day. Unopened
        bottles return free within 30 days — no questions, no forms in triplicate.
      </>
    ),
  },
];

/** Design v2 FAQ — native details/summary with the rotating "+" ring. */
export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[820px] px-[var(--gutter)] py-[var(--sect)]">
      <Reveal>
        <Eyebrow num="07" className="mb-[clamp(18px,3vw,28px)]">
          Fine print
        </Eyebrow>
      </Reveal>
      <Reveal>
        <h2 className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight">
          Asked, answered.
        </h2>
      </Reveal>

      <div className="mt-[clamp(30px,5vw,48px)]">
        {ITEMS.map((item, i) => (
          <Reveal key={item.q} delay={i * 60}>
            <details className="group border-t border-bone/10 last:border-b">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-5 py-[22px] text-[1.05rem] font-medium transition-colors hover:text-gold [-webkit-tap-highlight-color:transparent]">
                {item.q}
                <span
                  aria-hidden
                  className="relative size-[34px] flex-none rounded-full border border-bone/[0.14] transition-[transform,border-color] duration-300 group-open:rotate-45 group-open:border-gold/55 before:absolute before:left-1/2 before:top-1/2 before:h-[1.5px] before:w-3 before:-translate-x-1/2 before:-translate-y-1/2 before:bg-bone/80 after:absolute after:left-1/2 after:top-1/2 after:h-[1.5px] after:w-3 after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-90 after:bg-bone/80"
                />
              </summary>
              <p className="max-w-[620px] pb-[26px] text-bone/60">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
