import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createRazorpayOrder } from "@/lib/razorpay";
import { clientEnv } from "@/lib/env";
import { getCart, getCartOwner } from "@/lib/cart/service";
import { getVariantWithProduct } from "@/lib/catalog/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildItemsSnapshot,
  buildOrderNotes,
  computeCheckoutAmounts,
  findUnavailableLines,
  type CheckoutLine,
} from "@/lib/checkout/pure";
import type { ShippingDetails } from "@/lib/contracts";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Checkout creation — the ONE place that talks to Razorpay on the way in. The client sends
// ONLY email + shipping address (Zod-parsed in the action); every amount is computed
// server-side from the live server cart (payments.md: the client cannot influence money).
// The pure math lives in lib/checkout/pure.ts (unit-tested); this module is the I/O shell:
//   1. enrich + hard stock-check the cart;
//   2. compute amounts and stage the full cart snapshot into checkout_sessions (the row the
//      webhook's record_paid_order will consume — Razorpay notes cannot carry a cart);
//   3. create the Razorpay Order for the staged total (receipt = staging row id);
//   4. stamp the provider_order_id back onto the staging row.
// The staging write uses the ADMIN client because checkout_sessions is deny-all under RLS
// (rls.sql): shoppers never read/write it directly; it exists only for the webhook.

export type CheckoutCreated = {
  /** Razorpay order id (order_…) — the modal's `order_id` and our correlation key. */
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  /** Prefill for the Razorpay modal. */
  email: string;
  keyId: string;
};

export async function createCheckout(input: {
  email: string;
  shipping: ShippingDetails;
}): Promise<ActionResult<CheckoutCreated>> {
  const keyId = clientEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    return fail({ code: "validation", message: "Payments aren't configured yet." });
  }

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
  // Authenticated shoppers checkout under their ACCOUNT email — the form value is ignored for
  // them (contracts.createCheckoutSchema note); guests use the form email.
  const email = owner.email ?? input.email;
  const amounts = computeCheckoutAmounts(enriched);
  const currency = cart.currency.toUpperCase();

  const admin = createAdminClient();
  try {
    // Stage first, then create the provider order: an orphaned 'created' staging row is inert
    // (deny-all, never consumed), whereas a Razorpay order with no staging row would pay into
    // session_not_found.
    const { data: staged, error: stageError } = await admin
      .from("checkout_sessions")
      .insert({
        user_id: owner.userId,
        cart_id: owner.cartId,
        email,
        currency,
        amount_subtotal_minor: amounts.subtotalMinor,
        amount_shipping_minor: amounts.shippingMinor,
        amount_tax_minor: amounts.taxMinor,
        amount_total_minor: amounts.totalMinor,
        shipping_name: input.shipping.name,
        shipping_address: {
          line1: input.shipping.line1,
          line2: input.shipping.line2 ?? null,
          city: input.shipping.city,
          state: input.shipping.state,
          postal_code: input.shipping.postal_code,
          country: input.shipping.country,
        },
        items: buildItemsSnapshot(enriched),
        // provider_order_id is NOT NULL — stamp a placeholder the Razorpay call overwrites;
        // unique per row so concurrent checkouts can't collide.
        provider_order_id: `pending_${crypto.randomUUID()}`,
      })
      .select("id")
      .single();
    if (stageError || !staged) throw stageError ?? new Error("staging insert returned no row");

    const order = await createRazorpayOrder({
      amountMinor: amounts.totalMinor,
      currency,
      receipt: staged.id,
      notes: buildOrderNotes({
        checkoutSessionId: staged.id,
        userId: owner.userId,
        cartId: owner.cartId,
      }),
    });

    const { error: stampError } = await admin
      .from("checkout_sessions")
      .update({ provider_order_id: order.id })
      .eq("id", staged.id);
    if (stampError) throw stampError;

    return ok({
      providerOrderId: order.id,
      amountMinor: amounts.totalMinor,
      currency,
      email,
      keyId,
    });
  } catch (error) {
    Sentry.captureException(error);
    return fail({ code: "unknown", message: "Couldn't start checkout. Please try again." });
  }
}
