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
      className="relative grid size-11 place-items-center rounded-full text-bone/90 transition-colors hover:bg-bone/10 hover:text-bone"
    >
      <ShoppingCart className="size-5" strokeWidth={1.8} />
      <span
        aria-hidden
        className={`absolute right-0 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[0.62rem] font-bold leading-none ${
          cart.itemCount > 0 ? "bg-gold text-ink" : "bg-fern text-bone/60"
        }`}
      >
        {cart.itemCount > 9 ? "9+" : cart.itemCount}
      </span>
    </button>
  );
}
