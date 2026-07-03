import "server-only";

import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getStripe } from "@/lib/stripe";
import { clientEnv } from "@/lib/env";
import { getCart, getCartOwner } from "@/lib/cart/service";
import { getVariantWithProduct } from "@/lib/catalog/queries";
import {
  buildLineItemsFromCart,
  buildSessionMetadata,
  buildShippingOption,
  findUnavailableLines,
  type CheckoutLine,
} from "@/lib/checkout/pure";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Checkout-session creation — the ONE place that talks to Stripe on the way in. Takes NO
// client input by design (payments.md: line items and amounts are computed server-side from
// the live server cart; the client cannot influence money). The pure builders live in
// lib/checkout/pure.ts (unit-tested); this module is the I/O shell around them.

/**
 * Create an Embedded Checkout Session from the caller's live cart (guest cookie or DB cart).
 * Rejects empty carts and over-stock lines with typed errors BEFORE any Stripe call
 * (PRD AC#7). Returns the client secret the embedded surface mounts with.
 */
export async function createEmbeddedCheckoutSession(): Promise<
  ActionResult<{ clientSecret: string }>
> {
  const cart = await getCart();
  if (cart.lines.length === 0) {
    return fail({ code: "validation", message: "Your cart is empty." });
  }

  // Enrich each line with LIVE variant fields (sku for the snapshot, inventory for the hard
  // stock check) — re-resolving from the catalog so nothing stale or client-shaped is priced.
  const enriched: CheckoutLine[] = [];
  for (const line of cart.lines) {
    const found = await getVariantWithProduct(line.variantId);
    if (!found) {
      return fail({
        code: "validation",
        message: `"${line.productTitle}" is no longer available. Remove it from your cart and try again.`,
      });
    }
    enriched.push({
      ...line,
      sku: found.variant.sku ?? null,
      inventoryCount: found.variant.inventory_count,
    });
  }

  const unavailable = findUnavailableLines(enriched);
  if (unavailable.length > 0) {
    const names = unavailable.map((l) => `"${l.productTitle}"`).join(", ");
    return fail({
      code: "validation",
      message: `Not enough stock for ${names}. Adjust the quantity and try again.`,
    });
  }

  const owner = await getCartOwner();
  const params: Stripe.Checkout.SessionCreateParams = {
    // "embedded_page" = Embedded Checkout on API 2026-06-24.dahlia (renamed from "embedded").
    ui_mode: "embedded_page",
    mode: "payment",
    line_items: buildLineItemsFromCart(enriched),
    shipping_options: [buildShippingOption(cart.subtotalMinor, cart.currency)],
    shipping_address_collection: { allowed_countries: ["IN"] },
    automatic_tax: { enabled: true },
    metadata: buildSessionMetadata({
      userId: owner.userId,
      cartId: owner.cartId,
      subtotalMinor: cart.subtotalMinor,
    }),
    // Stripe substitutes the session id itself — the return page re-parses it as untrusted.
    return_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    ...(owner.email ? { customer_email: owner.email } : {}),
  };

  try {
    const session = await createSessionWithTaxFallback(getStripe(), params);
    if (!session.client_secret) {
      return fail({ code: "unknown", message: "Couldn't start checkout. Please try again." });
    }
    return ok({ clientSecret: session.client_secret });
  } catch (error) {
    Sentry.captureException(error);
    return fail({ code: "unknown", message: "Couldn't start checkout. Please try again." });
  }
}

/**
 * Gate-1 decision #1 (Stripe Tax vs India origin): attempt `automatic_tax`; if the account
 * rejects it as unsupported, retry ONCE without it and log loudly. Tax then records as 0 —
 * acceptable for GST-inclusive Indian retail pricing. Any other error propagates untouched.
 */
async function createSessionWithTaxFallback(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (error) {
    if (!isAutomaticTaxUnsupported(error)) throw error;
    console.warn(
      JSON.stringify({
        source: "checkout",
        event: "automatic_tax_unsupported_fallback",
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    Sentry.captureMessage(
      "Stripe automatic_tax unsupported on this account — session created without it (tax=0)",
      "warning",
    );
    const withoutTax = { ...params };
    delete withoutTax.automatic_tax;
    return stripe.checkout.sessions.create(withoutTax);
  }
}

function isAutomaticTaxUnsupported(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) return false;
  const haystack = `${error.param ?? ""} ${error.message}`.toLowerCase();
  return (
    haystack.includes("automatic_tax") ||
    haystack.includes("automatic tax") ||
    haystack.includes("origin address") ||
    haystack.includes("head office")
  );
}
