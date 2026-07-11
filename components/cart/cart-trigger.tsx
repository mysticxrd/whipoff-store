"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { analytics } from "@/lib/analytics";

/** Header cart affordance: live item count + opens the drawer (Slice 2, replaces the static /cart link). */
export function CartTrigger() {
  const { cart, open } = useCart();

  function handleClick() {
    analytics.cartViewed({
      cart_value_minor: cart.subtotalMinor,
      currency: cart.currency,
      item_count: cart.itemCount,
    });
    open();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
      className="relative inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-bone/90 transition-colors hover:bg-bone/10 hover:text-bone"
    >
      <ShoppingCart className="size-5" strokeWidth={1.8} />
      <span className="text-sm font-medium sm:hidden">Cart</span>
      {cart.itemCount > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-ink"
        >
          {cart.itemCount > 9 ? "9+" : cart.itemCount}
        </span>
      ) : null}
    </button>
  );
}
