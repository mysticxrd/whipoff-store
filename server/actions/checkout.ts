"use server";

import { revalidatePath } from "next/cache";
import {
  createCheckoutSchema,
  razorpayCallbackSchema,
  type CreateCheckoutInput,
  type RazorpayCallback,
} from "@/lib/contracts";
import { createCheckout as createCheckoutService, type CheckoutCreated } from "@/lib/checkout/service";
import { clearOwnCart, getCart, type CartView } from "@/lib/cart/service";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Checkout actions. `createCheckout` takes ONLY email + shipping address (payments.md /
// contracts.ts): the cart is read server-side and every amount recomputed from live variants —
// prices and quantities are never client input. `verifyPayment` exists because the webhook
// (the order-truth writer) runs outside the shopper's request and CANNOT touch the guest cart
// cookie — only a Server Action in the shopper's own request can clear it.

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<ActionResult<CheckoutCreated>> {
  const parsed = createCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail({ code: "validation", message: "Check your email and shipping details." });
  }
  return createCheckoutService(parsed.data);
}

/**
 * Fired once by the Razorpay modal's success handler. Verifies the callback signature —
 * HMAC-SHA256(order_id|payment_id, key_secret), provable only by Razorpay — before clearing
 * the CALLER's own cart (guest cookie + RLS-scoped DB cart). This is the Finding-#2 guard in
 * Razorpay form: the signature only exists after a successful payment, so the cart is never
 * cleared on an unpaid/failed attempt, and the shopper can retry with the cart intact.
 * A forged callback fails the HMAC; a replayed genuine one can at worst re-clear the caller's
 * own (already empty) cart — it grants nothing and never touches order state, which remains
 * the webhook's exclusive job (record_paid_order clears the DB cart authoritatively too).
 */
export async function verifyPayment(
  input: RazorpayCallback,
): Promise<ActionResult<{ orderId: string; cart: CartView }>> {
  const parsed = razorpayCallbackSchema.safeParse(input);
  if (!parsed.success) {
    return fail({ code: "validation", message: "Invalid payment response." });
  }

  const verified = verifyPaymentSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  if (!verified) {
    return fail({ code: "validation", message: "Payment could not be verified." });
  }

  await clearOwnCart();
  revalidatePath("/", "layout");
  return ok({ orderId: parsed.data.razorpay_order_id, cart: await getCart() });
}
