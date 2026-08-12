import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";

const ENTRIES = [
  {
    meta: "ENTRY № 0847 — KOZHIKODE",
    quote: "“Holds on vertical panels long enough to scrub properly, then rinses clean.”",
    who: "ARJUN M. · ’19 POLO GT TSI",
  },
  {
    meta: "ENTRY № 0912 — KANNUR",
    quote: "“Took half the usual time and the finish looked better than the local wash.”",
    who: "SHIFAD · HONDA CIVIC ZX",
  },
  {
    meta: "ENTRY № 1044 — KOCHI",
    quote: "“No swirls after, just clean paint and a proper gloss.”",
    who: "ADITHYAN · ETIOS LIVA",
  },
  {
    meta: "ENTRY № 1108 — BENGALURU",
    quote: "“Foam holds on the tank long enough to scrub without chasing drips.”",
    who: "DEV P. · ’23 INTERCEPTOR 650",
  },
];

/** Design v2 LOGBOOK — owners' notes as numbered log entries. */
export function Logbook() {
  return (
    <section id="logbook" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-[var(--sect)]">
      <Reveal>
        <Eyebrow num="06" className="mb-[clamp(18px,3vw,28px)]">
          From the logbook
        </Eyebrow>
      </Reveal>
      <Reveal>
        <h2 className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight text-balance">
          Owners’ notes,
          <br />
          <em className="italic text-gold [font-variation-settings:'opsz'_144,'SOFT'_90,'WONK'_1]">
            unedited.
          </em>
        </h2>
      </Reveal>

      <div className="mt-[clamp(36px,6vw,60px)] grid gap-3.5 md:grid-cols-2 md:gap-[18px]">
        {ENTRIES.map((entry, i) => (
          <Reveal key={entry.meta} delay={(i % 2) * 90}>
            <blockquote className="flex h-full flex-col gap-[18px] rounded-lg border border-bone/10 bg-pine p-[clamp(24px,4vw,36px)] transition-colors duration-300 hover:border-gold/55">
              <p className="mono-label text-[0.6rem] text-bone/60">{entry.meta}</p>
              <p className="font-display text-[clamp(1.25rem,3.4vw,1.6rem)] font-normal leading-[1.3] text-balance [font-variation-settings:'opsz'_60,'SOFT'_80,'WONK'_0]">
                {entry.quote}
              </p>
              <footer className="mono-label mt-auto text-[0.62rem] text-gold">{entry.who}</footer>
            </blockquote>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
