const ITEMS = [
  "FOAMS LIKE WHIPPED CREAM",
  "pH 6.9 — DEAD NEUTRAL",
  "1 : 256 DILUTION",
  "SAFE ON CERAMIC · WAX · PPF",
  "ZERO RESIDUE",
  "GLOSS, NOT GIMMICKS",
];

function Track() {
  return (
    <div className="flex shrink-0 items-center gap-[38px] whitespace-nowrap pr-[38px]">
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-[38px]">
          <span className="font-mono text-[0.72rem] tracking-[0.18em] text-bone/60">{item}</span>
          <span className="text-[0.45rem] text-gold" aria-hidden>
            ●
          </span>
        </span>
      ))}
    </div>
  );
}

/** Design v2 ticker — infinite CSS marquee, two copies translated -50% for a seamless loop. */
export function Marquee() {
  return (
    <div aria-hidden className="overflow-hidden border-y border-bone/10 bg-pine py-4">
      <div className="flex w-max animate-marquee">
        <Track />
        <Track />
      </div>
    </div>
  );
}
