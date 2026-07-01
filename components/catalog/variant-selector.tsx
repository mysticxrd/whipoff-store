"use client";

import { useState } from "react";
import { AddToCartCta } from "@/components/catalog/add-to-cart-cta";
import { Badge } from "@/components/ui/badge";
import { analytics } from "@/lib/analytics";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Variant } from "@/supabase/types";

// PDP purchase panel: owns the selected-variant state so the price, availability, and the sticky
// CTA all update together. Defaults to the first in-stock variant. Fires `variant_selected`.
export function VariantSelector({
  productId,
  variants,
}: {
  productId: string;
  variants: Variant[];
}) {
  const [selectedId, setSelectedId] = useState<string>(
    () => (variants.find((v) => v.inventory_count > 0) ?? variants[0])?.id ?? "",
  );

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return null; // no variants — nothing to purchase (defensive)

  const available = selected.inventory_count > 0;
  const priceLabel = formatPrice(selected.price_cents, selected.currency);

  function select(variant: Variant) {
    setSelectedId(variant.id);
    analytics.variantSelected({
      product_id: productId,
      variant_id: variant.id,
      value_minor: variant.price_cents,
      currency: variant.currency,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 ? (
        <div>
          <span className="block text-sm font-medium text-foreground">
            Choose an option
          </span>
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
                    "min-h-11 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
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

      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-foreground">{priceLabel}</span>
        <Badge variant={available ? "secondary" : "outline"}>
          {available ? "In stock" : "Out of stock"}
        </Badge>
      </div>

      <AddToCartCta priceLabel={priceLabel} available={available} />
    </div>
  );
}
