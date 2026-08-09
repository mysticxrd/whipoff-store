import { Eyebrow } from "@/components/home/eyebrow";
import { Gauge } from "@/components/home/gauge";
import { Reveal } from "@/components/home/reveal";

const SPECS = [
  ["CHEMISTRY", "pH-neutral surfactant blend, Hydroilx™ slip polymers"],
  ["DILUTION", "1 : 256 — 19 ml per 5 L bucket"],
  ["SAFE ON", "wax · sealant · ceramic · PPF · vinyl"],
  ["CUTS", "traffic film, bug residue, a fortnight of neglect"],
  ["LEAVES", "nothing. zero residue, zero water spots"],
] as const;

/** Design v2 FORMULA — three instrument gauges + the mono spec sheet, on a pine band. */
export function Formula() {
  return (
    <section id="formula" className="border-y border-bone/10 bg-pine py-[var(--sect)]">
      <div className="mx-auto mb-[clamp(48px,8vw,90px)] max-w-[1200px] px-[var(--gutter)]">
        <Reveal>
          <Eyebrow num="02" className="mb-[clamp(18px,3vw,28px)]">
            The Hydroilx™ formula
          </Eyebrow>
        </Reveal>
        <Reveal>
          <h2 className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight text-balance">
            Numbers you can quote
            <br />
            <em className="italic text-gold [font-variation-settings:'opsz'_144,'SOFT'_90,'WONK'_1]">
              at Cars &amp; Coffee.
            </em>
          </h2>
        </Reveal>
      </div>

      {/* gauges — horizontal snap on mobile, 3-up at desktop */}
      <div className="no-scrollbar mx-auto grid max-w-[1200px] snap-x snap-mandatory grid-flow-col auto-cols-[min(76vw,320px)] gap-[18px] overflow-x-auto px-[var(--gutter)] pb-[26px] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-3 lg:overflow-visible">
        <Gauge
          min={0}
          max={14}
          value={6.9}
          lo={6.5}
          hi={7.5}
          majors={7}
          decimals={1}
          valueSuffix=" pH"
          label="DEAD NEUTRAL — COATINGS UNTOUCHED"
        />
        <Gauge
          min={0}
          max={100}
          value={92}
          lo={80}
          hi={100}
          majors={5}
          decimals={0}
          valueSuffix=" % FOAM"
          label="DENSE, CLINGING, SLOW-COLLAPSE"
        />
        <Gauge
          min={0}
          max={1}
          value={0.08}
          lo={0}
          hi={0.15}
          majors={5}
          decimals={2}
          valuePrefix="µ "
          label="SLIP POLYMERS — NEAR-ZERO DRAG"
        />
      </div>

      <dl className="mx-auto mt-[clamp(40px,7vw,70px)] max-w-[1200px] px-[var(--gutter)]">
        {SPECS.map(([dt, dd], i) => (
          <Reveal key={dt} delay={i * 60}>
            <div className="grid grid-cols-[108px_1fr] items-baseline gap-4 border-t border-bone/10 py-4 last:border-b md:grid-cols-[220px_1fr] md:py-5">
              <dt className="mono-label text-[0.66rem] text-gold">{dt}</dt>
              <dd className="font-mono text-[0.8rem] leading-[1.75] text-bone/80 md:text-[0.85rem]">
                {dd}
              </dd>
            </div>
          </Reveal>
        ))}
        {/* bottom hairline on the final row */}
        <div className="border-t border-bone/10" />
      </dl>
    </section>
  );
}
