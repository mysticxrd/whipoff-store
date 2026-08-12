import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createRazorpayOrder } from "@/lib/razorpay";
import { assertRazorpayOrderCredentialsConfigured } from "@/lib/env-server";
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

export type CheckoutCreated = {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  email: string;
  keyId: string;
};

export async function createCheckout(input: {
  email: string;
  shipping: ShippingDetails;
}): Promise<ActionResult<CheckoutCreated>> {
  let keyId: string;
  try {
    // Fail before any cart/admin/session work if either half of this deployment's Razorpay
    // credential pair is missing or mode-mismatched. A bad configuration must never create an
    // orphaned checkout_sessions row containing shopper data.
    keyId = assertRazorpayOrderCredentialsConfigured();
  } catch {
    return fail({ code: "validation", message: "Payments aren't configured for this environment." });
  }

  const cart = await getCart();
  if (cart.lines.length === 0) {
    return fail({ code: "validation", message: "Your cart is empty." });
  }

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
  const email = owner.email ?? input.email;
  const amounts = computeCheckoutAmounts(enriched);
  const currency = cart.currency.toUpperCase();

  const admin = createAdminClient();
  try {
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
          ...(input.shipping.phone ? { phone: input.shipping.phone } : {}),
        },
        items: buildItemsSnapshot(enriched),
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
