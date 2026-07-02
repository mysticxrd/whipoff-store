"use client";

import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Live as of Slice 2: adds the selected variant × quantity to the cart. Driven by the selected
// variant (price + availability) from the variant selector, which owns the mutation + pending/
// error state and passes them down. `sticky` (default true) pins it as a fixed bottom bar (the
// thumb-reach pattern on the PDP); `sticky={false}` renders an inline full-width button for
// surfaces with other content below (the homepage buy section).
export function AddToCartCta({
  priceLabel,
  available,
  pending = false,
  error,
  onAddToCart,
  sticky = true,
}: {
  priceLabel: string;
  available: boolean;
  pending?: boolean;
  error?: string | null;
  onAddToCart: () => void;
  sticky?: boolean;
}) {
  const disabled = !available || pending;
  const button = (
    <button
      type="button"
      onClick={onAddToCart}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        buttonVariants({ size: "lg" }),
        "gap-2",
        sticky ? "flex-1" : "w-full",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {!available ? "Out of stock" : pending ? "Adding…" : "Add to cart"}
    </button>
  );

  if (!sticky) {
    return (
      <div className="flex flex-col gap-2">
        {button}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {error ? (
        <p role="alert" className="px-4 pt-2 text-center text-xs text-danger">
          {error}
        </p>
      ) : null}
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
