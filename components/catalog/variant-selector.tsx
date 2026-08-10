"use client";

import { useState, useTransition } from "react";
import { AddToCartCta } from "@/components/catalog/add-to-cart-cta";
import { useCart } from "@/components/cart/cart-provider";
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
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState<string>(
    () => (variants.find((v) => v.inventory_count > 0) ?? variants[0])?.id ?? "",
  );
  const [qty, setQty] = useState(1);
  const [isAdding, startAdding] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

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
    setAddError(null);
    analytics.variantSelected({
      product_id: productId,
      variant_id: variant.id,
      value_minor: variant.price_cents,
      currency: variant.currency,
    });
  }

  function handleAddToCart() {
    setAddError(null);
    startAdding(async () => {
      // Re-check inside the closure: TS doesn't carry the component-level narrowing of `selected`
      // across this function boundary, even though it's guaranteed non-null by the early return above.
      if (!selected) return;
      const result = await addItem(selected.id, qty);
      if (!result.ok) setAddError(result.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {variants.length > 1 ? (
        <fieldset className="grid gap-2.5 border-0 sm:grid-cols-3">
          <legend className="mono-label mb-3 text-[0.62rem] text-bone/60 uppercase">Size</legend>
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
                  "grid min-h-16 grid-cols-[1fr_auto] items-center gap-x-3 rounded-[14px] border px-4 py-3.5 text-left transition-[border-color,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-1 sm:gap-y-1",
                  isSelected
                    ? "border-bone bg-bone/[0.08]"
                    : "border-bone/[0.14] hover:border-bone/40",
                  soldOut && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "text-[1.05rem] font-medium text-foreground",
                    soldOut && "line-through",
                  )}
                >
                  {variant.title}
                </span>
                <span className="row-start-2 sm:row-start-auto">
                  <span className="mono-label text-[0.62rem] text-bone/60 uppercase">
                    {soldOut ? "Sold out" : "In stock"}
                  </span>
                </span>
                <span className="col-start-2 row-span-2 text-right font-medium sm:col-start-auto sm:row-span-1 sm:mt-1.5 sm:text-left">
                  {formatPrice(variant.price_cents, variant.currency)}
                  {LAUNCH_SALE_ACTIVE ? (
                    <s className="ml-1.5 text-[0.82rem] font-normal text-bone/40">
                      {formatWasPrice(variant.price_cents, variant.currency)}
                    </s>
                  ) : null}
                </span>
              </button>
            );
          })}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-medium text-foreground">{priceLabel}</span>
          {wasPriceLabel ? (
            <s className="text-base font-normal text-bone/40">{wasPriceLabel}</s>
          ) : null}
        </div>
        {LAUNCH_SALE_ACTIVE ? (
          <span className="mono-label rounded-full border border-gold/55 px-3 py-1 text-[0.62rem] text-gold uppercase">
            Launch · Save 20%
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-none items-center rounded-full border border-bone/[0.14]">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="grid h-[54px] w-12 place-items-center rounded-full text-[1.2rem] text-bone/60 transition-colors hover:text-bone"
          >
            −
          </button>
          <span className="min-w-5 text-center font-mono text-[0.95rem] tabular-nums text-foreground">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(qtyMax, q + 1))}
            aria-label="Increase quantity"
            className="grid h-[54px] w-12 place-items-center rounded-full text-[1.2rem] text-bone/60 transition-colors hover:text-bone"
          >
            +
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <AddToCartCta
            priceLabel={priceLabel}
            available={available}
            pending={isAdding}
            error={addError}
            onAddToCart={handleAddToCart}
            sticky={sticky}
          />
        </div>
      </div>
    </div>
  );
}
