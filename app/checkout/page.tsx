import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCart } from "@/lib/cart/service";
import { clientEnv } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { CheckoutEmbed } from "@/components/checkout/checkout-embed";

export const metadata: Metadata = { title: "Checkout" };

/**
 * /checkout — Stripe owns the entire payment surface (Embedded Checkout mounted below);
 * this page is only the framing: a way back, a totals strip for drawer-parity confidence,
 * and the embed. Minimal distractions by design (design_system.md checkout pattern).
 * Guest-accessible on purpose (Gate-1 locked decision) — NOT in PROTECTED_PREFIXES.
 */
export default async function CheckoutPage() {
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/");

  const configured = Boolean(clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <Link
        href="/products"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.8} />
        Back to shop
      </Link>

      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl font-black text-foreground sm:text-3xl">
          Checkout
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} ·{" "}
          <span className="font-semibold text-foreground">
            {formatPrice(cart.totalMinor, cart.currency)}
          </span>
        </p>
      </div>

      {configured ? (
        <div className="mt-6">
          <CheckoutEmbed />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-pine p-5">
          <h2 className="font-display text-base font-bold text-foreground">
            Payments aren&rsquo;t switched on yet.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            This environment has no Stripe key configured, so checkout can&rsquo;t start.
            Your cart is safe — come back once payments are live.
          </p>
        </div>
      )}
    </main>
  );
}
