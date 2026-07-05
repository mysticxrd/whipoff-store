"use server";

import { revalidatePath } from "next/cache";
import {
  clearCartAfterCheckoutSchema,
  type ClearCartAfterCheckoutInput,
} from "@/lib/contracts";
import { createEmbeddedCheckoutSession } from "@/lib/checkout/service";
import { clearOwnCart, getCart, type CartView } from "@/lib/cart/service";
import { deriveOrderStatus } from "@/lib/checkout/pure";
import { getStripe } from "@/lib/stripe";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Checkout actions. `createCheckoutSession` takes NO input BY DESIGN (payments.md /
// contracts.ts): the cart is read server-side and every amount recomputed from live
// variants — there is nothing the client could legitimately tell us. `clearCartAfterCheckout`
// exists because the webhook (the order-truth writer) runs outside the shopper's request and
// CANNOT touch the guest cart cookie — only a Server Action in the shopper's own request can.

export async function createCheckoutSession(): Promise<ActionResult<{ clientSecret: string }>> {
  return createEmbeddedCheckoutSession();
}

/**
 * Fired once by the return page after Stripe hands the shopper back. Verifies the session is
 * actually COMPLETE and PAID with Stripe before clearing, then empties the CALLER's own cart
 * (guest cookie + RLS-scoped DB cart). A forged/foreign session id can at worst clear the
 * caller's own cart — it grants nothing and touches no one else's rows.
 */
export async function clearCartAfterCheckout(
  input: ClearCartAfterCheckoutInput,
): Promise<ActionResult<CartView>> {
  const parsed = clearCartAfterCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail({ code: "validation", message: "Invalid checkout session." });
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data.sessionId);
    if (session.status !== "complete") {
      return fail({ code: "validation", message: "This checkout hasn't completed." });
    }
    // Async methods (e.g. bank debits) hand back status="complete" while payment_status is
    // still "unpaid", and may later async_payment_failed. Clear ONLY once payment is actually
    // captured — a failed async pay must leave the cart intact so the shopper can retry. When
    // an async pay later succeeds, the webhook's apply_paid_order_effects clears the DB cart
    // authoritatively; this action's remaining job is the guest cookie the webhook can't reach.
    // Same "is-paid" definition as the webhook order-write (deriveOrderStatus) so the cart-clear
    // decision and the order-status decision can never drift.
    if (deriveOrderStatus(session.payment_status) !== "paid") {
      return fail({ code: "validation", message: "Payment is still processing." });
    }
  } catch {
    return fail({ code: "unknown", message: "Couldn't verify the checkout session." });
  }

  await clearOwnCart();
  revalidatePath("/", "layout");
  return ok(await getCart());
}
