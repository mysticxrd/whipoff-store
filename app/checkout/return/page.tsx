import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { checkoutReturnQuerySchema } from "@/lib/contracts";
import { getCheckoutReturnState } from "@/lib/checkout/status";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order status" };

// Never cache: this page races the webhook — the same order_id flips processing → confirmed.
export const dynamic = "force-dynamic";

/**
 * /checkout/return — where the checkout form sends the shopper after the Razorpay modal
 * closes (?order_id=order_…). PRESENTATIONAL ONLY (payments.md): the page derives a coarse
 * state server-side (lib/checkout/status.ts); order truth is written exclusively by the
 * webhook, and NOTHING here triggers fulfilment. The order_id arrives via the shopper's
 * browser → strict Zod parse, invalid/unknown = 404 (same posture as the PDP slug).
 *
 * NO buyer PII or amount is rendered here: an order_… id is NOT proof of ownership, so
 * echoing the staged email / ₹total would let anyone holding a valid id read another
 * shopper's details (the Stripe-era "drop the echo" finding — posture preserved verbatim).
 * The order-confirmation email (Resend) is the channel of record; this page only reports
 * the coarse payment OUTCOME, which leaks nothing sensitive.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = checkoutReturnQuerySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();

  const state = await getCheckoutReturnState(parsed.data.order_id);
  if (state === "not_found") notFound();

  if (state === "confirmed") {
    return (
      <StatusShell>
        <StatusIcon tone="success">
          <CheckCircle2 className="size-7" strokeWidth={1.7} />
        </StatusIcon>
        <h1 className="mt-5 font-display text-2xl font-black text-foreground">
          Order confirmed. Foam incoming.
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
          Payment received — your receipt is on its way to your inbox.
        </p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Continue shopping
        </Link>
      </StatusShell>
    );
  }

  if (state === "failed") {
    // failed_at telemetry, not a terminal state — the cart was never cleared on this path
    // (verifyPayment only fires on a signed success), so retrying is one click.
    return (
      <StatusShell>
        <StatusIcon tone="muted">
          <XCircle className="size-7" strokeWidth={1.7} />
        </StatusIcon>
        <h1 className="mt-5 font-display text-2xl font-black text-foreground">
          That payment didn&rsquo;t go through.
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
          No money was taken. Your cart is exactly as you left it — try again whenever
          you&rsquo;re ready.
        </p>
        <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Try again
        </Link>
        <Link
          href="/products"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-2")}
        >
          Back to shop
        </Link>
      </StatusShell>
    );
  }

  // processing — payment done (or still settling) client-side; the webhook hasn't landed yet.
  return (
    <StatusShell>
      <StatusIcon tone="pending">
        <Clock3 className="size-7" strokeWidth={1.7} />
      </StatusIcon>
      <h1 className="mt-5 font-display text-2xl font-black text-foreground">
        Payment processing…
      </h1>
      <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
        We&rsquo;re confirming your payment. This page updates on refresh — and we&rsquo;ll
        email you the moment it settles.
      </p>
      <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
        Continue shopping
      </Link>
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      {children}
    </main>
  );
}

function StatusIcon({
  tone,
  children,
}: {
  tone: "success" | "pending" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid size-16 place-items-center rounded-full",
        tone === "success" && "bg-success-bg text-success",
        tone === "pending" && "bg-bone/10 text-gold",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
