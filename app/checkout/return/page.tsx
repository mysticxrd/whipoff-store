import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type Stripe from "stripe";
import { CheckCircle2, Clock3, TimerOff } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { checkoutReturnQuerySchema } from "@/lib/contracts";
import { deriveOrderStatus } from "@/lib/checkout/pure";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FinalizeReturn } from "@/components/checkout/finalize-return";

export const metadata: Metadata = { title: "Order status" };

/**
 * /checkout/return — where Stripe hands the shopper back ({CHECKOUT_SESSION_ID} substituted
 * into the return_url). PRESENTATIONAL ONLY (payments.md): the page reads the session and
 * shows its state; order truth is written exclusively by the webhook, and NOTHING here
 * triggers fulfilment. The session_id arrives via the shopper's browser → strict Zod parse,
 * invalid/unknown = 404 (same posture as the PDP slug).
 *
 * NO buyer PII or amount is rendered here: a session_id is NOT proof of ownership, so echoing
 * customer_details.email / amount_total would let anyone holding a valid cs_... id read another
 * shopper's email + total (03_verify Low — "drop the echo"). The order-confirmation email
 * (Slice 5, Resend) is the channel of record for those details; this page only reports the
 * coarse payment OUTCOME (confirmed vs. still processing), which leaks nothing sensitive.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = checkoutReturnQuerySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(parsed.data.session_id);
  } catch {
    notFound(); // unknown / foreign-account session id — nothing to show
  }

  if (session.status === "complete") {
    // Same "is-paid" definition the webhook order-write uses (deriveOrderStatus): `paid` and
    // `no_payment_required` count as paid; an async method still confirming is "unpaid". This is
    // the ONLY thing read off the session for display — no email, no total (see the file header).
    const paid = deriveOrderStatus(session.payment_status) === "paid";

    return (
      <StatusShell>
        {paid ? (
          <>
            {/* Payment captured — safe to clear the cart now (the webhook can't reach the guest
                cookie; only this in-request Server Action can). The still-confirming async case
                is the pending branch below: we deliberately do NOT clear there, so a later
                async_payment_failed leaves the cart intact to retry. */}
            <FinalizeReturn sessionId={session.id} />
            <StatusIcon tone="success">
              <CheckCircle2 className="size-7" strokeWidth={1.7} />
            </StatusIcon>
            <h1 className="mt-5 font-display text-2xl font-black text-foreground">
              Order confirmed. Foam incoming.
            </h1>
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
              Payment received — your receipt is on its way to your inbox.
            </p>
          </>
        ) : (
          <>
            <StatusIcon tone="pending">
              <Clock3 className="size-7" strokeWidth={1.7} />
            </StatusIcon>
            <h1 className="mt-5 font-display text-2xl font-black text-foreground">
              Payment processing…
            </h1>
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
              Your payment method is still confirming. Your order is locked in — we&rsquo;ll
              email you the moment it settles.
            </p>
          </>
        )}
        <Link
          href="/"
          className={cn(buttonVariants({ size: "lg" }), "mt-6")}
        >
          Continue shopping
        </Link>
      </StatusShell>
    );
  }

  if (session.status === "open") {
    // Abandoned mid-payment: the session is still payable — offer the way back (PRD AC#4).
    return (
      <StatusShell>
        <StatusIcon tone="pending">
          <Clock3 className="size-7" strokeWidth={1.7} />
        </StatusIcon>
        <h1 className="mt-5 font-display text-2xl font-black text-foreground">
          Your checkout is still open.
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
          No payment was taken. Your cart is exactly as you left it.
        </p>
        <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Resume checkout
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-2")}
        >
          Back to shop
        </Link>
      </StatusShell>
    );
  }

  // expired
  return (
    <StatusShell>
      <StatusIcon tone="muted">
        <TimerOff className="size-7" strokeWidth={1.7} />
      </StatusIcon>
      <h1 className="mt-5 font-display text-2xl font-black text-foreground">
        That checkout expired.
      </h1>
      <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
        No payment was taken — start again whenever you&rsquo;re ready.
      </p>
      <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
        Start checkout again
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
