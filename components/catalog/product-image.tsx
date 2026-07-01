import { cn } from "@/lib/utils";

// Placeholder product imagery — a deterministic CSS gradient, NOT a loaded file.
//
// Why: Slice 1 has no real photography or remote image host (out of scope), and shipping binary
// assets just to fill boxes adds weight with no value. A gradient derived from a per-image token
// gives every product (and every gallery position) a stable, distinct look with zero network,
// zero layout shift, and no next/image config. Swapped for <Image> when real assets land.
// (Recorded in stages/02_build/output/build_notes.md as a deviation from the plan's SVG assets.)

function hashHue(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) % 360;
  }
  return h;
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0] ?? "");
  return letters.join("").toUpperCase() || "•";
}

export function ProductImage({
  token,
  alt,
  name,
  className,
}: {
  /** Stable string the hue is derived from (e.g. an image url token or product slug). */
  token: string;
  /** Accessible label for the placeholder. */
  alt: string;
  /** Product title — drives the monogram shown on the gradient. */
  name: string;
  className?: string;
}) {
  const h1 = hashHue(token);
  const h2 = (h1 + 40) % 360;
  const background = `linear-gradient(135deg, hsl(${h1} 58% 52%), hsl(${h2} 62% 38%))`;

  return (
    <div
      role="img"
      aria-label={alt}
      style={{ background }}
      className={cn(
        "flex h-full w-full items-center justify-center select-none",
        className,
      )}
    >
      <span className="text-3xl font-bold tracking-wide text-white/85 drop-shadow-sm">
        {monogram(name)}
      </span>
    </div>
  );
}
