"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The button is intentionally DISABLED this slice ("coming soon"); add-to-cart lands in Slice 2.
// Driven by the selected variant (price + availability) from the variant selector.
// `sticky` (default true) pins it as a fixed bottom bar — the thumb-reach pattern used on a
// focused buy page (the PDP). Set `sticky={false}` for an inline full-width button instead,
// for surfaces that already have other content and CTAs below (the homepage buy section).
export function AddToCartCta({
  priceLabel,
  available,
  sticky = true,
}: {
  priceLabel: string;
  available: boolean;
  sticky?: boolean;
}) {
  const button = (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={cn(buttonVariants({ size: "lg" }), sticky ? "flex-1" : "w-full")}
      title="Add to cart is coming in the next update"
    >
      Add to cart — coming soon
    </button>
  );

  if (!sticky) return button;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {available ? "In stock" : "Out of stock"}
          </span>
          <span className="text-lg font-semibold text-foreground">{priceLabel}</span>
        </div>
        {button}
      </div>
    </div>
  );
}
