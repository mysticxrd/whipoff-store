// Pure checkout logic — Stripe session payload builders and webhook→order mapping.
//
// NO "server-only" import and NO I/O (no Stripe client, no Supabase, no next/headers), so all
// money-touching shapes are unit-testable with plain objects — mirroring lib/cart/pure.ts vs
// service.ts. lib/checkout/service.ts (session creation) and app/api/webhooks/stripe/route.ts
// (order write) are thin wrappers around this module.
//
// Money posture (payments.md / security_shield flaw #3): every amount here is derived from
// live variant prices on the way IN (buildLineItemsFromCart) and from Stripe's authoritative
// session amounts on the way OUT (mapSessionToOrderPayload). Nothing client-sent is ever a
// price. Integer minor units + currency throughout.

import type { CartLineView } from "@/lib/cart/pure";
import { checkoutSessionMetadataSchema, variantIdSchema } from "@/lib/contracts";
import { computeShippingMinor } from "@/lib/money";

// ---------------------------------------------------------------------------
// Session creation (app → Stripe)
// ---------------------------------------------------------------------------

/** A cart line enriched with the live variant fields checkout needs beyond the CartView. */
export type CheckoutLine = CartLineView & {
  sku: string | null;
  inventoryCount: number;
};

/**
 * Hard inventory check at session creation (PRD AC#7, carried from Slice 2): a line whose
 * quantity exceeds LIVE stock blocks the session. Returns the offending lines for the error
 * message (empty array = all good).
 */
export function findUnavailableLines(lines: CheckoutLine[]): CheckoutLine[] {
  return lines.filter((line) => line.quantity > line.inventoryCount);
}

/**
 * One Stripe Checkout line item per cart line, priced from the LIVE variant (price_data —
 * we don't maintain Stripe Price objects). `product_data.metadata` carries the variant
 * identity + display snapshot PER LINE, so the webhook reads variant linkage off the same
 * expanded objects that carry Stripe's authoritative amounts (no 500-char session-metadata
 * truncation risk, survives cart mutation mid-checkout).
 */
export type EmbeddedLineItem = {
  quantity: number;
  price_data: {
    currency: string; // lowercase ISO-4217, per Stripe
    unit_amount: number; // integer minor units
    product_data: {
      name: string;
      metadata: Record<string, string>;
    };
  };
};

export function buildLineItemsFromCart(lines: CheckoutLine[]): EmbeddedLineItem[] {
  return lines.map((line) => {
    const metadata: Record<string, string> = {
      variant_id: line.variantId,
      product_title: line.productTitle,
      variant_title: line.variantTitle,
    };
    if (line.sku) metadata.sku = line.sku;
    return {
      quantity: line.quantity,
      price_data: {
        currency: line.currency.toLowerCase(),
        unit_amount: line.unitPriceMinor,
        product_data: {
          name: `${line.productTitle} — ${line.variantTitle}`,
          metadata,
        },
      },
    };
  });
}

/**
 * Shipping parity with the cart drawer: a single fixed-amount option computed by the SAME
 * `computeShippingMinor` the cart uses (₹49 under the free-ship threshold, else ₹0) — so
 * Stripe's total always matches the drawer's total (PRD AC#2).
 */
export type FixedShippingOption = {
  shipping_rate_data: {
    display_name: string;
    type: "fixed_amount";
    fixed_amount: { amount: number; currency: string };
  };
};

export function buildShippingOption(
  subtotalMinor: number,
  currency: string,
): FixedShippingOption {
  const amount = computeShippingMinor(subtotalMinor);
  return {
    shipping_rate_data: {
      display_name: amount === 0 ? "Free shipping" : "Standard shipping",
      type: "fixed_amount",
      fixed_amount: { amount, currency: currency.toLowerCase() },
    },
  };
}

/**
 * Session metadata for reconciliation (contracts.checkoutSessionMetadataSchema is the
 * round-trip contract; the webhook re-parses with it). Values are strings — that's all
 * Stripe metadata holds. `'guest'` marks the signed-out path on both ids.
 */
export function buildSessionMetadata(input: {
  userId: string | null;
  cartId: string | null;
  subtotalMinor: number;
}): Record<string, string> {
  return {
    user_id: input.userId ?? "guest",
    cart_id: input.cartId ?? "guest",
    cart_subtotal_minor: String(input.subtotalMinor),
  };
}

// ---------------------------------------------------------------------------
// Webhook → order (Stripe → app)
// ---------------------------------------------------------------------------

/**
 * Order status from Stripe's payment_status. `no_payment_required` counts as paid (Stripe
 * semantics: nothing owed); `unpaid` on a completed session = an async method still
 * processing → the order lands as 'pending' and finalize_stripe_order transitions it later.
 */
export function deriveOrderStatus(paymentStatus: string): "paid" | "pending" {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required"
    ? "paid"
    : "pending";
}

// Narrow STRUCTURAL views of the Stripe objects the mapper reads — Stripe.Checkout.Session /
// Stripe.LineItem satisfy them, and unit tests can build them as plain literals.
export type WebhookSessionShape = {
  id: string;
  payment_status: string;
  currency?: string | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  total_details?: {
    amount_tax?: number | null;
    amount_shipping?: number | null;
  } | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  collected_information?: {
    shipping_details?: { name?: string | null; address?: unknown } | null;
  } | null;
  payment_intent?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type WebhookLineItemShape = {
  quantity?: number | null;
  amount_total?: number | null;
  price?: {
    unit_amount?: number | null;
    // `deleted` exists only so Stripe's Product (`deleted?: void`) and DeletedProduct
    // (`deleted: true`) both satisfy this weak type — a deleted product has no metadata,
    // which mapSessionToOrderPayload rejects as missing_variant_id.
    product?:
      | string
      | { metadata?: Record<string, string> | null; name?: string | null; deleted?: unknown }
      | null;
  } | null;
};

/** jsonb payloads for the record_stripe_order RPC (keys mirror migration.sql exactly). */
export type OrderJson = {
  user_id: string | null;
  email: string;
  status: "pending" | "paid";
  currency: string;
  amount_subtotal_minor: number;
  amount_shipping_minor: number;
  amount_tax_minor: number;
  amount_total_minor: number;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string | null;
  shipping_name: string | null;
  shipping_address: unknown;
};

export type OrderItemJson = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  currency: string;
};

export type SessionMapResult =
  | {
      ok: true;
      order: OrderJson;
      items: OrderItemJson[];
      userId: string | null;
      cartId: string | null;
      /** Stripe's subtotal ≠ the snapshot we stamped at creation — flag it, don't "fix" it. */
      subtotalMismatch: boolean;
    }
  | { ok: false; reason: string };

/**
 * Map a completed Checkout Session (+ its EXPANDED line items) to the RPC payloads.
 * Every failure here is PERMANENT — a malformed event no amount of Stripe retrying will
 * heal — so the webhook responds 200 + alert, never 500 (payments.md idempotency posture).
 * Amounts come from Stripe (the money-truth after payment); metadata is re-parsed with the
 * shared Zod contract because it round-tripped through Stripe (trust boundary, flaw #3).
 */
export function mapSessionToOrderPayload(
  session: WebhookSessionShape,
  lineItems: WebhookLineItemShape[],
): SessionMapResult {
  const metadata = checkoutSessionMetadataSchema.safeParse(session.metadata ?? {});
  if (!metadata.success) return { ok: false, reason: "invalid_session_metadata" };

  const email = session.customer_details?.email;
  if (!email) return { ok: false, reason: "missing_customer_email" };

  if (
    typeof session.amount_subtotal !== "number" ||
    typeof session.amount_total !== "number"
  ) {
    return { ok: false, reason: "missing_session_amounts" };
  }

  if (lineItems.length === 0) return { ok: false, reason: "no_line_items" };

  const currency = (session.currency ?? "inr").toUpperCase();
  const items: OrderItemJson[] = [];
  for (const item of lineItems) {
    const product = item.price?.product;
    const productMeta =
      typeof product === "object" && product !== null ? (product.metadata ?? {}) : {};
    const variantId = variantIdSchema.safeParse(productMeta.variant_id);
    if (!variantId.success) return { ok: false, reason: "missing_variant_id" };
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      return { ok: false, reason: "invalid_line_quantity" };
    }
    if (typeof item.price?.unit_amount !== "number") {
      return { ok: false, reason: "missing_unit_amount" };
    }
    items.push({
      variant_id: variantId.data,
      product_title: productMeta.product_title ?? "Unknown product",
      variant_title: productMeta.variant_title ?? "Standard",
      sku: productMeta.sku ?? null,
      unit_price_minor: item.price.unit_amount,
      quantity: item.quantity,
      line_total_minor: item.amount_total ?? item.price.unit_amount * item.quantity,
      currency,
    });
  }

  const userId = metadata.data.user_id === "guest" ? null : metadata.data.user_id;
  const cartId = metadata.data.cart_id === "guest" ? null : metadata.data.cart_id;
  const shipping = session.collected_information?.shipping_details;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  return {
    ok: true,
    order: {
      user_id: userId,
      email,
      status: deriveOrderStatus(session.payment_status),
      currency,
      amount_subtotal_minor: session.amount_subtotal,
      amount_shipping_minor: session.total_details?.amount_shipping ?? 0,
      amount_tax_minor: session.total_details?.amount_tax ?? 0,
      amount_total_minor: session.amount_total,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      shipping_name: shipping?.name ?? session.customer_details?.name ?? null,
      shipping_address: shipping?.address ?? null,
    },
    items,
    userId,
    cartId,
    subtotalMismatch: session.amount_subtotal !== metadata.data.cart_subtotal_minor,
  };
}
