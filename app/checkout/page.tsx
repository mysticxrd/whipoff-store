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
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/#buy"
        className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/50 transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        Back to shop
      </Link>

      <div className="mt-3 flex items-end justify-between gap-4 border-b border-bone/10 pb-5">
        <h1 className="font-display text-[clamp(2rem,6vw,2.75rem)] font-medium leading-none tracking-tight text-bone">
          Checkout
        </h1>
        <p className="pb-1 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-bone/50">
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} ·{" "}
          <span className="font-semibold text-bone">
            {formatPrice(cart.totalMinor, cart.currency)}
          </span>
        </p>
      </div>

      {configured ? (
        <div className="mt-7">
          <CheckoutForm />
        </div>
      ) : (
        <div className="mt-7 rounded-[10px] border border-bone/14 bg-pine p-5">
          <h2 className="font-display text-base font-medium text-bone">
            Payments aren&rsquo;t switched on yet.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-bone/60">
            This environment has no safely scoped Razorpay key configured, so checkout can&rsquo;t
            start. Your cart is safe — come back once payments are live.
          </p>
        </div>
      )}
    </main>
  );
}
