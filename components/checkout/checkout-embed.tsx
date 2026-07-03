"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { createCheckoutSession } from "@/server/actions/checkout";
import { useCart } from "@/components/cart/cart-provider";
import { analytics } from "@/lib/analytics";
import { clientEnv } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The interactive leaf of /checkout: fetches the session's client secret via the Server
// Action (which reads the cart server-side — no input crosses this boundary), then mounts
// Stripe's Embedded Checkout. Only the PUBLISHABLE key is used here (client-safe by design).
// Module-level singleton per Stripe.js guidance — created once, not per render.
const stripePromise = clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type EmbedState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; clientSecret: string };

export function CheckoutEmbed() {
  const { cart, open } = useCart();
  const [state, setState] = useState<EmbedState>({ phase: "loading" });
  const startedRef = useRef(false);

  const createSession = useCallback(async () => {
    setState({ phase: "loading" });
    const result = await createCheckoutSession();
    if (result.ok && result.data) {
      setState({ phase: "ready", clientSecret: result.data.clientSecret });
    } else {
      setState({
        phase: "error",
        message: result.ok
          ? "Couldn't start checkout. Please try again."
          : result.error.message,
      });
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return; // strict-mode double-mount guard
    startedRef.current = true;
    analytics.checkoutStarted({
      cart_value_minor: cart.subtotalMinor,
      currency: cart.currency,
      item_count: cart.itemCount,
    });
    void createSession();
    // Fire-once on mount by design: the snapshot at checkout entry is the funnel event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.phase === "error") {
    return (
      <div className="rounded-lg border border-border bg-white p-5 shadow-xs">
        <h2 className="font-display text-base font-bold text-foreground">
          Checkout couldn&rsquo;t start.
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void createSession()}
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={open}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
          >
            Review cart
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "loading" || !stripePromise) {
    return (
      <div
        role="status"
        aria-label="Loading secure checkout"
        className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-white"
      >
        <p className="animate-pulse font-mono text-sm text-muted-foreground">
          Loading secure checkout…
        </p>
      </div>
    );
  }

  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ clientSecret: state.clientSecret }}
    >
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
