"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { createCheckout, verifyPayment } from "@/server/actions/checkout";
import { useCart } from "@/components/cart/cart-provider";
import { analytics } from "@/lib/analytics";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The interactive leaf of /checkout: collects email + shipping (Razorpay's modal does NOT
// collect addresses), then opens Razorpay Standard Checkout. checkout.js MUST load from
// Razorpay's CDN (their integration contract — it cannot be self-hosted or bundled; PRD Q7).
// Only the publishable rzp_test_ key id ever reaches this file, and it arrives from the
// server action's response — no secret, no amount, and no price originates client-side: the
// server recomputes everything from the live cart and the modal binds to the server-created
// order_id. The form values here are a CONVENIENCE COPY for the shopper; the server re-parses
// them with the same Zod schema (createCheckoutSchema) before anything is staged.

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type FormPhase =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "verifying" }
  | { phase: "error"; message: string };

export function CheckoutForm() {
  const router = useRouter();
  const { cart, open } = useCart();
  const [state, setState] = useState<FormPhase>({ phase: "idle" });
  const [scriptReady, setScriptReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // strict-mode double-mount guard
    startedRef.current = true;
    analytics.checkoutStarted({
      cart_value_minor: cart.subtotalMinor,
      currency: cart.currency,
      item_count: cart.itemCount,
    });
    // Fire-once on mount by design: the snapshot at checkout entry is the funnel event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.phase === "submitting" || state.phase === "verifying") return;
    if (!window.Razorpay) {
      setState({
        phase: "error",
        message: "The payment window couldn't load. Check your connection and try again.",
      });
      return;
    }

    const form = new FormData(event.currentTarget);
    const read = (name: string) => String(form.get(name) ?? "").trim();
    const line2 = read("line2");
    const phone = read("phone");

    setState({ phase: "submitting" });
    const result = await createCheckout({
      email: read("email"),
      shipping: {
        name: read("name"),
        line1: read("line1"),
        ...(line2 ? { line2 } : {}),
        city: read("city"),
        state: read("state"),
        postal_code: read("postal_code"),
        country: "IN",
        ...(phone ? { phone } : {}),
      },
    });
    if (!result.ok || !result.data) {
      setState({
        phase: "error",
        message: !result.ok ? result.error.message : "Couldn't start checkout. Please try again.",
      });
      return;
    }

    const checkout = result.data;
    const razorpay = new window.Razorpay({
      key: checkout.keyId,
      order_id: checkout.providerOrderId,
      amount: checkout.amountMinor,
      currency: checkout.currency,
      name: "Whipoff",
      description: "Car-care order",
      prefill: {
        email: checkout.email,
        name: read("name"),
        ...(phone ? { contact: phone } : {}),
      },
      // Success: Razorpay hands back the signed (order_id, payment_id, signature) triple.
      // verifyPayment checks the HMAC server-side and clears the cart ONLY then (Finding #2:
      // a dismissed or failed attempt leaves the cart intact to retry). Order truth is still
      // the webhook's — the return page just polls its outcome.
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        setState({ phase: "verifying" });
        void verifyPayment(response)
          .then((verified) => {
            if (verified.ok) {
              router.push(`/checkout/return?order_id=${encodeURIComponent(checkout.providerOrderId)}`);
            } else {
              setState({
                phase: "error",
                message: "We couldn't verify that payment. If you were charged, you'll still get your receipt by email.",
              });
            }
          })
          .catch(() => {
            // The action rejected (transient server error) rather than returning {ok:false}.
            // The shopper may already be charged — the webhook still writes the order + emails
            // the receipt independently. Never strand the UI on "Verifying…"; send them to the
            // return page, which polls the authoritative outcome.
            router.push(`/checkout/return?order_id=${encodeURIComponent(checkout.providerOrderId)}`);
          });
      },
      modal: {
        ondismiss: () => {
          // Abandoned mid-payment: nothing was staged as paid, the cart is untouched.
          setState({ phase: "idle" });
        },
      },
      theme: { color: "#1a4d3e" },
    });
    razorpay.open();
  }

  const busy = state.phase === "submitting" || state.phase === "verifying";

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() =>
          // checkout.js blocked (ad-blocker / network). Without this the Pay button, gated on
          // scriptReady, would stay disabled forever with no explanation — surface it instead.
          setState({
            phase: "error",
            message: "The payment window couldn't load. Check your connection and try again.",
          })
        }
      />

      {state.phase === "error" ? (
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-xs">
          <p className="text-sm leading-relaxed text-foreground">{state.message}</p>
          <button
            type="button"
            onClick={open}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            Review cart
          </button>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4" aria-busy={busy}>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Full name" name="name" autoComplete="name" required />
        <Field label="Address" name="line1" autoComplete="address-line1" required />
        <Field
          label="Apartment, suite, etc. (optional)"
          name="line2"
          autoComplete="address-line2"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" name="city" autoComplete="address-level2" required />
          <Field label="State" name="state" autoComplete="address-level1" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="PIN code"
            name="postal_code"
            autoComplete="postal-code"
            inputMode="numeric"
            pattern="[1-9][0-9]{5}"
            title="6-digit Indian PIN code"
            required
          />
          <Field
            label="Phone (optional)"
            name="phone"
            type="tel"
            autoComplete="tel-national"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            title="10-digit Indian mobile number"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !scriptReady}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {state.phase === "verifying"
            ? "Verifying payment…"
            : state.phase === "submitting"
              ? "Opening secure payment…"
              : "Pay with card or UPI"}
        </button>
        <p className="text-center font-mono text-xs text-muted-foreground">
          Payments secured by Razorpay · cards &amp; UPI
        </p>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `checkout-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground shadow-xs outline-none transition-colors focus:border-foreground"
        {...rest}
      />
    </div>
  );
}
