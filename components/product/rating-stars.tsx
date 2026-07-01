import { cn } from "@/lib/utils";

const STAR_PATH = "M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.8 5.9 20.8 7.1 14 2.1 9.2 9 8.3z";

/** Static launch social-proof line (design copy) — swap for real review data once orders exist. */
export function RatingStars({ tone = "light" }: { tone?: "light" | "dark" }) {
  const starColor = tone === "dark" ? "text-green-400" : "text-green-600";
  const textColor = tone === "dark" ? "text-green-200" : "text-muted-foreground";
  const strongColor = tone === "dark" ? "text-green-100" : "text-foreground";

  return (
    <div className={cn("flex items-center gap-2 text-sm", textColor)}>
      <span className={cn("flex gap-px", starColor)} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d={STAR_PATH} />
          </svg>
        ))}
      </span>
      <span>
        <b className={strongColor}>4.8</b> · 1,204 reviews
      </span>
    </div>
  );
}
