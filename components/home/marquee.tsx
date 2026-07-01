const ITEMS = ["pH-Neutral", "Ceramic-Safe", "High-Foam", "Swirl-Free Contact", "Wax-Safe", "Hydroilx™ Slick"];

function Track() {
  return (
    <div className="flex shrink-0 items-center gap-6 whitespace-nowrap px-3 py-3 font-display text-lg font-black tracking-tight">
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-6">
          {item}
          <span className="opacity-45" aria-hidden>
            ◆
          </span>
        </span>
      ))}
    </div>
  );
}

/** Infinite CSS marquee — two copies of the track, translated -50% so the loop is seamless. */
export function Marquee() {
  return (
    <div className="overflow-hidden border-y border-black/10 bg-green-500 text-green-950">
      <div className="flex w-max animate-marquee">
        <Track />
        <Track />
      </div>
    </div>
  );
}
