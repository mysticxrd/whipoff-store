"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sticky purchase bar pinned to the bottom of the PDP — proves the thumb-reach pattern now.
// The button is intentionally DISABLED this slice ("coming soon"); add-to-cart lands in Slice 2.
// Driven by the selected variant (price + availability) from the variant selector.
export function AddToCartCta({
  priceLabel,
  available,
}: {
  priceLabel: string;
  available: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {available ? "In stock" : "Out of stock"}
          </span>
          <span className="text-lg font-semibold text-foreground">{priceLabel}</span>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(buttonVariants({ size: "lg" }), "flex-1")}
          title="Add to cart is coming in the next update"
        >
          Add to cart — coming soon
        </button>
      </div>
    </div>
  );
}
