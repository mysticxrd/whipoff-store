"use client";

import { useState, useTransition } from "react";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartLineView } from "@/lib/cart/service";

// One cart line: 64×64 thumbnail, name + variant label, qty stepper, line price, Remove.
// Mirrors the qty-stepper visual from components/catalog/variant-selector.tsx (pill shape,
// size-11 buttons) per stages/02_build/references/cart/spec.md.
export function CartLineItem({ line }: { line: CartLineView }) {
  const { updateQuantity, removeItem } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decrement() {
    setError(null);
    startTransition(async () => {
      // AC#3: decrementing at 1 offers remove (quantity can never go below 1).
      const result =
        line.quantity <= 1
          ? await removeItem(line.variantId)
          : await updateQuantity(line.variantId, line.quantity - 1);
      if (!result.ok) setError(result.error.message);
    });
  }

  function increment() {
    setError(null);
    startTransition(async () => {
      const result = await updateQuantity(line.variantId, line.quantity + 1);
      if (!result.ok) setError(result.error.message);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeItem(line.variantId);
      if (!result.ok) setError(result.error.message);
    });
  }

  return (
    <li className={cn("flex gap-3 py-4", isPending && "opacity-60")}>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-green-50">
        <CatalogImage
          url={line.imageUrl}
          alt={line.productTitle}
          name={line.productTitle}
          sizes="64px"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-sm font-bold leading-tight text-foreground">
            {line.productTitle}
          </p>
          <p className="shrink-0 font-display text-sm font-bold text-foreground">
            {formatPrice(line.lineTotalMinor, line.currency)}
          </p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {line.variantTitle}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <div className="inline-flex items-center overflow-hidden rounded-md border-[1.5px] border-ink-300 bg-white">
            <button
              type="button"
              onClick={decrement}
              disabled={isPending}
              aria-label={line.quantity <= 1 ? "Remove from cart" : "Decrease quantity"}
              className="grid size-10 place-items-center text-lg text-green-800 transition-colors hover:bg-green-50 disabled:pointer-events-none disabled:opacity-50"
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-foreground">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={increment}
              disabled={isPending || line.quantity >= 99}
              aria-label="Increase quantity"
              className="grid size-10 place-items-center text-lg text-green-800 transition-colors hover:bg-green-50 disabled:pointer-events-none disabled:opacity-50"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="text-xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-danger hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </li>
  );
}
