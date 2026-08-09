import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCart } from "@/lib/cart/service";
import { getRazorpayKeyId } from "@/lib/env-server";
import { formatPrice } from "@/lib/money";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/");

  // The form is rendered only when the server confirms the key is safe for this deployment.
  // This prevents an accidentally Preview-scoped rzp_live_ key from ever reaching Checkout.
  let configured = false;
  try {
    getRazorpayKeyId();
    configured = true;
  } catch {
    configured = false;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <Link
        href="/"
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
          <CheckoutForm />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-pine p-5">
          <h2 className="font-display text-base font-bold text-foreground">
            Payments aren&rsquo;t switched on yet.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            This environment has no safely scoped Razorpay key configured, so checkout can&rsquo;t
            start. Your cart is safe — come back once payments are live.
          </p>
        </div>
      )}
    </main>
  );
}
