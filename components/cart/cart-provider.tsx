"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addCartItem, removeCartItem, updateCartItemQuantity } from "@/server/actions/cart";
import { analytics } from "@/lib/analytics";
import type { ActionResult } from "@/lib/action-result";
import type { CartView } from "@/lib/cart/service";

// Single client-side source of truth for cart UI state (open/closed + the current CartView).
// Initialized from a server-fetched snapshot (root layout calls lib/cart/service.getCart()) so
// the header count and drawer are correct on first paint — no flash of an empty cart. Every
// mutation calls its Server Action, replaces `cart` with the FRESH server-recomputed CartView the
// action returns, and fires the matching analytics event (client-side, mirroring the Slice-1
// `variant_selected` precedent) — never optimistic, so displayed totals are never client-invented.

type CartContextValue = {
  cart: CartView;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (variantId: string, quantity: number) => Promise<ActionResult<CartView>>;
  updateQuantity: (variantId: string, quantity: number) => Promise<ActionResult<CartView>>;
  removeItem: (variantId: string) => Promise<ActionResult<CartView>>;
  /** Replace the whole client cart with a server-recomputed view (post-checkout clear). */
  replaceCart: (cart: CartView) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartView;
  children: ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    if (typeof document !== "undefined") {
      openerRef.current = document.activeElement as HTMLElement | null;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    openerRef.current?.focus?.();
    openerRef.current = null;
  }, []);

  const replaceCart = useCallback((next: CartView) => {
    setCart(next);
  }, []);

  const addItem = useCallback(async (variantId: string, quantity: number) => {
    const result = await addCartItem({ variantId, quantity });
    if (result.ok && result.data) {
      setCart(result.data);
      const line = result.data.lines.find((l) => l.variantId === variantId);
      if (line) {
        analytics.cartItemAdded({
          product_id: line.productId,
          variant_id: line.variantId,
          quantity,
          value_minor: line.unitPriceMinor,
          currency: line.currency,
          cart_value_minor: result.data.subtotalMinor,
        });
      }
      // A successful add always opens the drawer onto the fresh cart — that IS a cart view.
      analytics.cartViewed({
        cart_value_minor: result.data.subtotalMinor,
        currency: result.data.currency,
        item_count: result.data.itemCount,
      });
      open();
    }
    return result;
  }, [open]);

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      const before = cart.lines.find((l) => l.variantId === variantId);
      const result = await updateCartItemQuantity({ variantId, quantity });
      if (result.ok && result.data) {
        setCart(result.data);
        if (before) {
          analytics.cartQuantityUpdated({
            product_id: before.productId,
            variant_id: variantId,
            quantity,
            value_minor: before.unitPriceMinor,
            currency: before.currency,
            cart_value_minor: result.data.subtotalMinor,
          });
        }
      }
      return result;
    },
    [cart.lines],
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      const before = cart.lines.find((l) => l.variantId === variantId);
      const result = await removeCartItem({ variantId });
      if (result.ok && result.data) {
        setCart(result.data);
        if (before) {
          analytics.cartItemRemoved({
            product_id: before.productId,
            variant_id: variantId,
            quantity: before.quantity,
            value_minor: before.unitPriceMinor,
            currency: before.currency,
            cart_value_minor: result.data.subtotalMinor,
          });
        }
      }
      return result;
    },
    [cart.lines],
  );

  return (
    <CartContext.Provider
      value={{ cart, isOpen, open, close, addItem, updateQuantity, removeItem, replaceCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider.");
  return ctx;
}
