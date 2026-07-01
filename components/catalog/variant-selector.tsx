"use client";

import { useState } from "react";
import { AddToCartCta } from "@/components/catalog/add-to-cart-cta";
import { analytics } from "@/lib/analytics";
import { formatPrice, formatWasPrice, LAUNCH_SALE_ACTIVE } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Variant } from "@/supabase/types";

// Buy panel: owns the selected-variant AND quantity state so the price, availability, and the
// CTA all update together. Defaults to the first in-stock variant. Fires `variant_selected`.
export function VariantSelector({
  productId,
  variants,
  sticky = true,
}: {
  productId: string;
  variants: Variant[];
  /** Forwarded to AddToCartCta: fixed bottom bar (PDP) vs. an inline button (homepage). */
  sticky?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    () => (variants.find((v) => v.inventory_count > 0) ?? variants[0])?.id ?? "",
  );
  const [qty, setQty] = useState(1);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return null; // no variants — nothing to purchase (defensive)

  const available = selected.inventory_count > 0;
  const priceLabel = formatPrice(selected.price_cents, selected.currency);
  const wasPriceLabel = LAUNCH_SALE_ACTIVE
    ? formatWasPrice(selected.price_cents, selected.currency)
    : null;
  const qtyMax = Math.max(1, selected.inventory_count);

  function select(variant: Variant) {
    setSelectedId(variant.id);
    setQty((q) => Math.min(q, Math.max(1, variant.inventory_count)));
    analytics.variantSelected({
      product_id: productId,
      variant_id: variant.id,
      value_minor: variant.price_cents,
      currency: variant.currency,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {variants.length > 1 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-foreground">Size</span>
            <span className="text-sm text-muted-foreground">{selected.title} selected</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selected.id;
              const soldOut = variant.inventory_count <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => select(variant)}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-11 rounded-md border-[1.5px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isSelected
                      ? "border-green-800 bg-green-800 text-white"
                      : "border-ink-300 bg-white text-foreground hover:border-ink-400",
                    soldOut && "text-muted-foreground",
                  )}
                >
                  {variant.title}
                  {soldOut ? " · sold out" : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-black text-foreground">
            {priceLabel}
          </span>
          {wasPriceLabel ? (
            <span className="text-base font-semibold text-muted-foreground line-through">
              {wasPriceLabel}
            </span>
          ) : null}
        </div>
        {LAUNCH_SALE_ACTIVE ? (
          <span className="inline-flex items-center rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">
            Launch · Save 20%
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex items-center overflow-hidden rounded-md border-[1.5px] border-ink-300 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="grid size-11 place-items-center text-lg text-green-800 transition-colors hover:bg-green-50"
          >
            −
          </button>
          <span className="min-w-11 text-center font-semibold tabular-nums text-foreground">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(qtyMax, q + 1))}
            aria-label="Increase quantity"
            className="grid size-11 place-items-center text-lg text-green-800 transition-colors hover:bg-green-50"
          >
            +
          </button>
        </div>
        <span className="text-sm text-muted-foreground">
          {available ? "In stock · ships today" : "Out of stock"}
        </span>
      </div>

      <AddToCartCta priceLabel={priceLabel} available={available} sticky={sticky} />
    </div>
  );
}
