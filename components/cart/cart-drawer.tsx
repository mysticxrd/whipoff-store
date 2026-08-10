"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The cart's primary surface: a right-side slide-out drawer (min(460px,100vw)), not a route
// (stages/02_build/references/cart/spec.md). Hand-authored focus trap + ESC/overlay dismiss +
// scroll lock — no Radix Dialog is installed (tech_stack.md declares no such dependency), so this
// mirrors the "hand-authored primitive" posture already used for Button/Badge. Focus RESTORE to
// the opener is owned by CartProvider.close() (it captured the opener in open()).
export function CartDrawer() {
  const { cart, isOpen, close } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const initial = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)[0];
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const hasItems = cart.lines.length > 0;

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-200",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div onClick={close} aria-hidden className="absolute inset-0 bg-[rgba(4,10,8,0.6)] backdrop-blur-[3px]" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={cn(
          "absolute inset-y-0 right-0 flex h-full w-[min(460px,100vw)] flex-col border-l border-bone/10 bg-pine shadow-lg transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-bone/10 px-5 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">
            Your kit{" "}
            <span className="mono-label text-bone/40">({cart.itemCount})</span>
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>

        {hasItems ? (
          <>
            <ul className="flex-1 divide-y divide-bone/10 overflow-y-auto px-5">
              {cart.lines.map((line) => (
                <CartLineItem key={line.variantId} line={line} />
              ))}
            </ul>

            <div className="border-t border-bone/10 px-5 py-4">
              <dl className="space-y-1.5 font-mono text-sm">
                <div className="flex justify-between text-bone/60">
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(cart.subtotalMinor, cart.currency)}</dd>
                </div>
                <div className="flex justify-between text-bone/60">
                  <dt>Shipping</dt>
                  <dd>
                    {cart.shippingMinor === 0
                      ? "Free"
                      : formatPrice(cart.shippingMinor, cart.currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-bone/10 pt-1.5 font-display text-base font-semibold text-foreground">
                  <dt>Total</dt>
                  <dd>{formatPrice(cart.totalMinor, cart.currency)}</dd>
                </div>
              </dl>
              <Link
                href="/checkout"
                onClick={close}
                className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
              >
                Checkout →
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-bone/10 text-gold">
              <ShoppingCart className="size-7" strokeWidth={1.7} />
            </div>
            <h3 className="mt-5 font-display text-xl font-medium text-foreground">
              Nothing in the kit yet.
            </h3>
            <p className="mt-2 max-w-[30ch] font-display text-base italic leading-relaxed text-gold">
              The whip is waiting.
            </p>
            <Link
              href="/"
              onClick={close}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6")}
            >
              Shop Whipoff
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
