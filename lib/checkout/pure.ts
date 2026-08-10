// Pure checkout logic — stock gate, amount math, and the checkout_sessions snapshot builders.
//
// NO "server-only" import and NO I/O (no Razorpay client, no Supabase, no next/headers), so all
// money-touching shapes are unit-testable with plain objects — mirroring lib/cart/pure.ts vs
// service.ts. lib/checkout/service.ts (Razorpay-order creation + staging write) is a thin
// wrapper around this module; the ORDER write itself moved fully into SQL (record_paid_order),
// so the old webhook→order mapper is gone with the provider.
//
// Money posture (payments.md / security_shield flaw #3): every amount here is derived from
// live variant prices on the way IN. The client sends product ids and quantities are read from
// the server cart — nothing client-sent is ever a price. The amounts computed here are stamped
// into checkout_sessions AND into the Razorpay Order; record_paid_order cross-checks the
// webhook's captured amount against the staged total before any order exists. Integer minor
// units + currency throughout.

import type { CartLineView } from "@/lib/cart/pure";
import { computeShippingMinor } from "@/lib/money";

/** A cart line enriched with the live variant fields checkout needs beyond the CartView. */
export type CheckoutLine = CartLineView & {
  sku: string | null;
  inventoryCount: number;
};

/**
 * Hard inventory check at checkout creation (PRD AC#7, carried from Slice 2): a line whose
 * quantity exceeds LIVE stock blocks the checkout. Returns the offending lines for the error
 * message (empty array = all good).
 */
export function findUnavailableLines(lines: CheckoutLine[]): CheckoutLine[] {
  return lines.filter((line) => line.quantity > line.inventoryCount);
}

/**
 * The four staged amounts, computed ONCE here and written to both the Razorpay Order (total)
 * and the checkout_sessions row (all four). Shipping parity with the cart drawer: the SAME
 * `computeShippingMinor` the drawer uses (always ₹0 while FLAT_SHIP_FEE_MINOR is waived), so the
 * Razorpay modal total always matches the drawer's total (PRD AC#2). Tax is 0 BY DESIGN —
 * GST-inclusive pricing (PRD Q3): the catalog price already contains GST, there is no
 * added-at-checkout tax line.
 */
export type CheckoutAmounts = {
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function computeCheckoutAmounts(lines: CheckoutLine[]): CheckoutAmounts {
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const shippingMinor = computeShippingMinor(subtotalMinor);
  const taxMinor = 0; // GST-inclusive pricing — see docblock
  return {
    subtotalMinor,
    shippingMinor,
    taxMinor,
    totalMinor: subtotalMinor + shippingMinor + taxMinor,
  };
}

/**
 * One snapshot item per cart line for checkout_sessions.items (jsonb). Keys mirror the
 * order_items columns EXACTLY — record_paid_order copies these through verbatim
 * (`v_cs.items` → order_items insert), so this shape IS the order-items contract.
 */
export type CheckoutItemSnapshot = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  currency: string;
};

export function buildItemsSnapshot(lines: CheckoutLine[]): CheckoutItemSnapshot[] {
  return lines.map((line) => ({
    variant_id: line.variantId,
    product_title: line.productTitle,
    variant_title: line.variantTitle,
    sku: line.sku,
    unit_price_minor: line.unitPriceMinor,
    quantity: line.quantity,
    line_total_minor: line.lineTotalMinor,
    currency: line.currency.toUpperCase(),
  }));
}

/**
 * Razorpay Order `notes` — dashboard reconciliation ONLY (≤15 short k/v pairs; the real cart
 * snapshot lives in checkout_sessions, never in notes). `'guest'` marks the signed-out path.
 */
export function buildOrderNotes(input: {
  checkoutSessionId: string;
  userId: string | null;
  cartId: string | null;
}): Record<string, string> {
  return {
    checkout_session_id: input.checkoutSessionId,
    user_id: input.userId ?? "guest",
    cart_id: input.cartId ?? "guest",
  };
}
