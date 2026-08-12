// Zod contracts — Slice 0 (auth + profile) + Slice 1 (catalog reads) + Slice 2 (cart mutations)
// + Slice 3 (checkout + payments boundaries, RE-PLATFORMED to Razorpay by the provider-swap
// slice, 2026-07-12) + Slice 4 (account + order history + guest claim) + Slice 5
// (order-confirmation email receipt shape) + merchant “new order” alert (ops packing sheet).
//
// SINGLE SOURCE OF TRUTH for input validation, shared by client (UX) and server
// (re-validation). See shared/api_conventions.md and _config/security_shield.md flaw #3:
// the server MUST re-parse with these schemas before any side effect / query — client
// validation is UX only. Derive TS types via z.infer; never declare a parallel interface.

import { z } from "zod";

// ===========================================================================
// Slice 0 — auth + profile
// ===========================================================================

/** Sign-in surface: email only (magic-link / OTP style). */
export const signInSchema = z.object({
  // Zod 4: normalize (trim/lowercase) then validate format via top-level z.email().
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Profile update: display name. Empty input clears it (maps to the nullable
 * profiles.display_name column).
 */
export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Keep your display name under 80 characters.")
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ===========================================================================
// Slice 1 — catalog read boundaries
// ===========================================================================
// Search params (PLP filter/sort/page) and route params (PDP slug) cross a trust boundary,
// so they are parsed server-side before any query. Two different tolerances:
//  - LIST query is LENIENT: a bad value degrades to the default so the grid still renders (AC#2).
//  - SLUG param is STRICT: a malformed slug can match no product → the PDP 404s.

/** URL-safe slug: lowercase alphanumeric segments joined by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug.");

/** PLP sort options. */
export const productSortSchema = z.enum(["newest", "price_asc", "price_desc"]);
export type ProductSort = z.infer<typeof productSortSchema>;

/**
 * PLP query, parsed from searchParams. Lenient by design (`.catch` fallbacks): unknown or
 * malformed values fall back to defaults rather than throwing, so the listing always renders.
 *  - `category`: optional slug; an invalid value is dropped (no filter).
 *  - `sort`: defaults to "newest".
 *  - `page`: 1-based; coerced from string; anything invalid → 1.
 */
export const productListQuerySchema = z.object({
  category: slugSchema.optional().catch(undefined),
  sort: productSortSchema.catch("newest"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** PDP route param. Strict: an invalid slug is treated as not-found by the page. */
export const productSlugSchema = z.object({
  slug: slugSchema,
});
export type ProductSlugParam = z.infer<typeof productSlugSchema>;

// ===========================================================================
// Slice 2 — cart mutations
// ===========================================================================
// Cart writes cross a trust boundary, so — unlike the LENIENT Slice-1 read queries — these are
// STRICT: an invalid variant id or quantity REJECTS with a typed error, never silently degrades.
// The same schema validates the client form (UX) and re-validates in the Server Action before any
// write (security_shield flaw #3). Price is NEVER an input — the server recomputes line and cart
// totals from the variant (glossary), so the client cannot influence money. Mutations key a line
// by its VARIANT (not a DB row id) so the identical contract serves both the signed-in DB cart and
// the guest httpOnly-cookie cart.

/** Soft cap on quantity per cart line (mirrored by the cart_items CHECK constraint). */
export const MAX_CART_ITEM_QUANTITY = 99;

/** A variant identifier (uuid). */
export const variantIdSchema = z.uuid("Invalid variant.");

/** Quantity for one cart line: whole number in [1, MAX]. Coerced from FormData strings. */
export const cartQuantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(MAX_CART_ITEM_QUANTITY, `Quantity can be at most ${MAX_CART_ITEM_QUANTITY}.`);

/** Add a variant to the cart (or increment its existing line). Quantity defaults to 1. */
export const addCartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: cartQuantitySchema.default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

/** Set the absolute quantity of an existing cart line. (Removal is a separate action.) */
export const updateCartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: cartQuantitySchema,
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/** Remove a line from the cart entirely. */
export const removeCartItemSchema = z.object({
  variantId: variantIdSchema,
});
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;

// ===========================================================================
// Slice 3 — checkout + payments boundaries (RE-PLATFORMED: Stripe → Razorpay, 2026-07-12)
// ===========================================================================
// Checkout money is NEVER a client input: amounts are recomputed server-side from variants
// (payments.md: "never trust client-sent prices"). What changed with Razorpay:
//  - Razorpay Standard Checkout does NOT collect a shipping address (Stripe's session did),
//    so shipping details are now a FIRST-PARTY client input — a NEW trust boundary, parsed
//    strictly server-side before the Razorpay Order + checkout_sessions staging row are created.
//  - The old session-metadata round-trip (checkoutSessionMetadataSchema) is RETIRED: the cart
//    snapshot no longer travels through the provider — it is staged server-side in
//    public.checkout_sessions and read back by the webhook (migration.sql header).
//  - The modal's success handler posts { order_id, payment_id, signature } to the server —
//    a client-supplied triple, so its ONLY trusted use is as input to the server-side HMAC
//    verification (the signature proves the pair came from Razorpay; the values grant nothing
//    by themselves).
// RETIRED (were Stripe-shaped): checkoutSessionIdSchema (cs_… regex),
// checkoutSessionMetadataSchema. checkoutReturnQuerySchema / clearCartAfterCheckoutSchema are
// re-keyed from the Stripe session id to the Razorpay order id.

/** Order lifecycle (mirrors the public.order_status enum / domain glossary). `pending`,
 * `refunded`, `cancelled` are retained enum values but no code path writes them post-swap
 * (webhook writes `paid` only; failed checkouts never become Orders). */
export const orderStatusSchema = z.enum([
  "pending",
  "paid",
  "fulfilled",
  "refunded",
  "cancelled",
]);
export type OrderStatusValue = z.infer<typeof orderStatusSchema>;

/** A Razorpay order id (`order_…`). STRICT shape; length-capped defensively. */
export const providerOrderIdSchema = z
  .string()
  .max(64, "Invalid checkout reference.")
  .regex(/^order_[A-Za-z0-9]+$/, "Invalid checkout reference.");
export type ProviderOrderId = z.infer<typeof providerOrderIdSchema>;

/** A Razorpay payment id (`pay_…`). STRICT shape; length-capped defensively. */
export const providerPaymentIdSchema = z
  .string()
  .max(64, "Invalid payment reference.")
  .regex(/^pay_[A-Za-z0-9]+$/, "Invalid payment reference.");
export type ProviderPaymentId = z.infer<typeof providerPaymentIdSchema>;

/**
 * Shipping details — the NEW first-party client input (Razorpay collects contact/email, not
 * addresses). India-only store: 6-digit PIN (no leading 0), fixed country 'IN', optional
 * 10-digit mobile (Razorpay prefill wants bare digits; no +91). Parsed server-side before
 * any Razorpay Order / staging write (flaw #3); the parsed value becomes the
 * checkout_sessions.shipping_address snapshot in EXACTLY the shape the receipt email's
 * shippingAddressSnapshotSchema reads (line1/line2/city/state/postal_code/country).
 */
export const shippingDetailsSchema = z.object({
  name: z.string().trim().min(1, "Enter the recipient name.").max(200),
  line1: z.string().trim().min(1, "Enter an address.").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "Enter a city.").max(100),
  state: z.string().trim().min(1, "Enter a state.").max(100),
  postal_code: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code."),
  country: z.literal("IN").default("IN"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number.")
    .optional(),
});
export type ShippingDetails = z.infer<typeof shippingDetailsSchema>;

/**
 * Input for the checkout-creation Server Action. `email` is the receipt/claim identity for
 * guests; for AUTHENTICATED callers the server IGNORES this field and uses the session email
 * (client-supplied identity is never trusted over the JWT — flaw #3). Cart contents/amounts
 * are read server-side and are deliberately NOT inputs.
 */
export const createCheckoutSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  shipping: shippingDetailsSchema,
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

/**
 * The Razorpay success-handler callback payload (client → server). Field names are Razorpay's
 * own (snake_case, fixed by their checkout.js). UNTRUSTED until the server recomputes
 * HMAC-SHA256(order_id + "|" + payment_id, key_secret) and constant-time-compares it to
 * `razorpay_signature` — verification is the gate; these values grant nothing on their own.
 */
export const razorpayCallbackSchema = z.object({
  razorpay_order_id: providerOrderIdSchema,
  razorpay_payment_id: providerPaymentIdSchema,
  razorpay_signature: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "Invalid payment signature."),
});
export type RazorpayCallback = z.infer<typeof razorpayCallbackSchema>;

/** /checkout/return search params — re-keyed to the Razorpay order id. Strict: an invalid
 * id is treated as not-found (same posture as the retired cs_… schema). */
export const checkoutReturnQuerySchema = z.object({
  order_id: providerOrderIdSchema,
});
export type CheckoutReturnQuery = z.infer<typeof checkoutReturnQuerySchema>;

/** Input for the post-payment guest-cookie-cart-clear Server Action (fired by the return
 * surface; DB carts are cleared by the webhook inside apply_paid_order_effects). The server
 * verifies the referenced checkout's PAID state server-side before clearing — the Finding-#2
 * guard, re-platformed (a pending/failed checkout NEVER clears the cart). */
export const clearCartAfterCheckoutSchema = z.object({
  orderId: providerOrderIdSchema,
});
export type ClearCartAfterCheckoutInput = z.infer<typeof clearCartAfterCheckoutSchema>;

/**
 * Structural schema for the Razorpay webhook envelope — applied AFTER raw-body HMAC
 * verification (the signature authenticates; this parse only shapes). Minimal on purpose:
 * exactly the fields the handler reads. `payment.entity.amount` is Razorpay's integer
 * minor-unit (paise) amount — cross-checked in-RPC against the staged total (money truth).
 * The event id comes from the `x-razorpay-event-id` HEADER (paymentEventIdSchema), not the body.
 */
export const razorpayWebhookEventSchema = z.object({
  event: z.enum(["order.paid", "payment.captured", "payment.failed"]),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: providerPaymentIdSchema,
        order_id: providerOrderIdSchema,
        amount: z.number().int().nonnegative(),
        status: z.string(),
      }),
    }),
  }),
});
export type RazorpayWebhookEvent = z.infer<typeof razorpayWebhookEventSchema>;

/** The x-razorpay-event-id header value — the idempotency-ledger key. Opaque; bounded. */
export const paymentEventIdSchema = z.string().min(1).max(200);

// ===========================================================================
// Slice 4 — account + order history + guest claim boundaries
// ===========================================================================
// The account read side crosses several trust boundaries; each is parsed server-side before use
// (security_shield flaw #3). Note what is DELIBERATELY NOT here:
//  - The guest-claim has NO input contract BY DESIGN. claim_guest_orders() is parameterless; its
//    only "input" is the verified session JWT (auth.email()), which the client cannot forge. There
//    is nothing to validate because there is nothing the client supplies — that IS the security
//    property (PRD Gate-1 #2: "authenticating is proof of mailbox control").
//  - Order money/status are READ, never written from the client, so no write schema exists.
// The pure helpers below (normalizeEmail, formatOrderNumber, parseOrderSeq, isSafeReturnTo /
// safeReturnTo) are the offline-unit-testable "pure logic" the 03_verify mock posture leans on
// (PRD Gate-1 #5).

/**
 * Canonical email normalization — lowercase + trim. ALIGNED with the SQL claim matcher
 * `lower(btrim(email, <ASCII whitespace>))` in migration.sql for the ASCII-clean inputs we
 * accept (checkout-form / GoTrue emails): both strip the full ASCII whitespace set and lowercase.
 * Accepted residual (03_verify Finding 2): JS trim() also strips Unicode whitespace, and
 * toLowerCase() can diverge from Postgres lower() on locale glyphs — unreachable with
 * provider-issued emails. Pure + unit-testable.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Display prefix for the human-readable order number. */
export const ORDER_NUMBER_PREFIX = "WO-";

/**
 * Human-readable order number, e.g. `WO-000123`. Zero-padded to ≥6 digits; overflow past
 * 999999 simply widens (WO-1000000). Case-normalized on parse for tolerant URL/entry handling.
 * DISPLAY-ONLY — never an access/authorization token; RLS gates ownership, not this string
 * (PRD Gate-1 #3). Used as the public route key for /account/orders/[orderNumber].
 */
export const orderNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^WO-\d{6,}$/, "Invalid order number.");
export type OrderNumber = z.infer<typeof orderNumberSchema>;

/** Format a positive order_seq into its WO-###### display string. Pure + unit-testable. */
export function formatOrderNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error("order_seq must be a positive integer");
  }
  return `${ORDER_NUMBER_PREFIX}${String(seq).padStart(6, "0")}`;
}

/**
 * Parse a WO-###### string back to its numeric order_seq (for the RLS-gated lookup on
 * orders.order_seq). Returns null when the shape is invalid → the detail page soft-404s.
 * The number is NOT an authz token: a valid-but-not-owned seq still yields no row under RLS.
 */
export function parseOrderSeq(orderNumber: string): number | null {
  const parsed = orderNumberSchema.safeParse(orderNumber);
  if (!parsed.success) return null;
  return Number(parsed.data.slice(ORDER_NUMBER_PREFIX.length));
}

/** /account/orders/[orderNumber] route param. Strict: a malformed number is treated as not-found. */
export const accountOrderParamSchema = z.object({
  orderNumber: orderNumberSchema,
});
export type AccountOrderParam = z.infer<typeof accountOrderParamSchema>;

/**
 * Open-redirect-safe return-to target (security_shield flaw #3 for the auth flow). A safe target
 * is a SAME-ORIGIN absolute path only: it must start with a single "/", and must NOT be
 * protocol-relative ("//host"), backslash-tricked ("/\\host"), or contain control/whitespace
 * chars a browser might normalize into a scheme+host. Anything else is rejected and callers fall
 * back to DEFAULT_RETURN_TO. Pure + unit-testable.
 */
export const DEFAULT_RETURN_TO = "/account";

export function isSafeReturnTo(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  if (!value.startsWith("/")) return false; // must be an absolute path on our origin
  if (value.startsWith("//") || value.startsWith("/\\")) return false; // protocol-relative / backslash
  // Reject ASCII control chars (charCode <= 0x1F, or 0x7F DEL) — a numeric check, so no literal
  // control byte ever appears in this source. Ordinary path chars like "-" stay valid (/sign-in).
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return false;
  }
  // Reject any whitespace a browser might trim/normalize into a scheme+host.
  if (/\s/.test(value)) return false;
  return true;
}

export const returnToSchema = z
  .string()
  .trim()
  .refine(isSafeReturnTo, "Unsafe redirect target.");

/** Coerce any raw return-to (query param, form field) to a safe path, defaulting when unsafe. */
export function safeReturnTo(raw: unknown): string {
  const parsed = returnToSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_RETURN_TO;
}

/**
 * Auth callback params (the machine route /auth/callback that completes magic-link sign-in).
 * @supabase/ssr uses the PKCE flow exclusively: Supabase presents a `code` and the callback
 * exchanges it server-side (exchangeCodeForSession). There is no `token_hash`/OTP branch —
 * the callback implements only this shape. `redirectTo` is the post-verify destination and is
 * NEVER trusted raw — route it through safeReturnTo() before redirecting (open-redirect guard).
 */
export const authCallbackSchema = z.object({
  code: z.string().min(1).max(512),
  redirectTo: z.string().optional(),
});
export type AuthCallbackParams = z.infer<typeof authCallbackSchema>;

// ===========================================================================
// Slice 5 — order-confirmation email (Resend)
// ===========================================================================
// The payment webhook (Razorpay post-swap) is the ONLY trigger for this email, and it is ALREADY
// signature-verified with its envelope re-parsed server-side (razorpayWebhookEventSchema) — so
// Slice 5 introduces NO new CLIENT trust boundary and therefore no new client-input schema. What IS defined here is the
// INTERNAL receipt contract: the shape the webhook composes (from trusted, service-role-read
// orders + order_items rows) and hands to the Resend template. It is the single source of truth for
// the template's props and is parsed defensively before send, so a malformed receipt fails LOUDLY
// server-side (a genuine composition bug) instead of emailing a broken one. Money stays integer minor
// units + currency; totals are READ from the persisted order — NEVER re-derived here (PRD reuse rule).
// Display formatting reuses the existing money helper + formatOrderNumber (above); no amount is recomputed.
// The prefer-delivery posture (PRD Gate-1 #5) lives at the SEND step, not here — the only field made
// tolerant is the display-only shippingAddress (a provider-era-agnostic blob), which degrades to "no address
// shown" rather than blocking the receipt.

/** Minor-unit money amount (integer, non-negative) — mirrors the orders / order_items columns. */
const minorAmountSchema = z.number().int().nonnegative();

/**
 * One receipt line — a snapshot of an order_items row (immutable at purchase time). Denormalized
 * titles / sku travel with the receipt so it survives later catalog edits (glossary: Order line item).
 */
export const orderConfirmationLineSchema = z.object({
  productTitle: z.string().min(1),
  variantTitle: z.string().min(1),
  sku: z.string().nullable(),
  unitPriceMinor: minorAmountSchema,
  quantity: z.number().int().min(1),
  lineTotalMinor: minorAmountSchema,
});
export type OrderConfirmationLine = z.infer<typeof orderConfirmationLineSchema>;

/**
 * Shipping-address snapshot: the address object captured on the order (orders.shipping_address
 * jsonb — post-swap, our own shippingDetailsSchema snapshot; legacy rows may hold Stripe's shape,
 * which uses the same keys). Every field is optional/nullish so a partial address still renders, and
 * the WHOLE thing `.catch(null)`s to "no address shown" rather than throwing — a display-only detail
 * must never BLOCK the receipt (PRD Gate-1 #5 prefer-delivery). Unknown keys are stripped.
 */
export const shippingAddressSnapshotSchema = z
  .object({
    line1: z.string().nullish(),
    line2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    country: z.string().nullish(),
  })
  .nullable()
  .catch(null);
export type ShippingAddressSnapshot = z.infer<typeof shippingAddressSnapshotSchema>;

/**
 * The full order-confirmation receipt handed to the Resend template. Composed server-side from the
 * persisted order + its item snapshots (NEVER the client). `orderNumber` is the display WO-######
 * (formatOrderNumber); `recipientEmail` is the captured orders.email; `isGuest` (order.user_id was
 * NULL at purchase) selects the CTA — a guest is invited to sign in WITH THIS EMAIL to track the order
 * (ties to the Slice-4 verified claim), an authenticated buyer gets a link to /account/orders. There
 * is deliberately NO order-detail deep link for guests (that would bypass Slice-4 auth/RLS). Amounts
 * mirror the orders row (subtotal / shipping / tax / total) in integer minor units + currency.
 */
export const orderConfirmationEmailSchema = z.object({
  orderNumber: orderNumberSchema,
  recipientEmail: z.email(),
  currency: z.string().length(3),
  placedAt: z.string().min(1), // ISO timestamp — paid_at, falling back to created_at
  isGuest: z.boolean(),
  lines: z.array(orderConfirmationLineSchema).min(1),
  amountSubtotalMinor: minorAmountSchema,
  amountShippingMinor: minorAmountSchema,
  amountTaxMinor: minorAmountSchema,
  amountTotalMinor: minorAmountSchema,
  shippingName: z.string().nullable(),
  shippingAddress: shippingAddressSnapshotSchema,
});
export type OrderConfirmationEmail = z.infer<typeof orderConfirmationEmailSchema>;

// ===========================================================================
// Merchant “new order” alert (Resend) — ops packing sheet
// ===========================================================================
// Same trigger as Slice 5 (Razorpay webhook post record_paid_order). NO new client trust
// boundary. Internal compose contract only. Prefer-delivery + independent idempotency live
// at the SEND step (server/email/merchant-order-alert.ts). Buyer phone is optional on
// shippingDetailsSchema and, when present, lives on orders.shipping_address.phone.

/** Packing line — same snapshot shape as orderConfirmationLineSchema. */
export const merchantOrderAlertLineSchema = orderConfirmationLineSchema;
export type MerchantOrderAlertLine = z.infer<typeof merchantOrderAlertLineSchema>;

/**
 * Shipping snapshot for the merchant alert — customer receipt keys PLUS optional phone.
 * Display-only: whole object `.catch(null)` so a bad blob never blocks the ops alert.
 */
export const merchantShippingAddressSnapshotSchema = z
  .object({
    line1: z.string().nullish(),
    line2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    country: z.string().nullish(),
    phone: z.string().nullish(),
  })
  .nullable()
  .catch(null);
export type MerchantShippingAddressSnapshot = z.infer<
  typeof merchantShippingAddressSnapshotSchema
>;

/**
 * Ops packing-sheet handed to the Resend merchant template. Composed server-side from the
 * persisted Order + item snapshots (NEVER the client). `merchantEmail` is MERCHANT_NOTIFY_EMAIL
 * (ops), not the buyer. `buyerPhone` is null when absent — never fails the send.
 */
export const merchantOrderAlertEmailSchema = z.object({
  orderNumber: orderNumberSchema,
  merchantEmail: z.email(),
  buyerEmail: z.email(),
  buyerPhone: z.string().nullable(),
  currency: z.string().length(3),
  paidAt: z.string().min(1),
  lines: z.array(merchantOrderAlertLineSchema).min(1),
  amountSubtotalMinor: minorAmountSchema,
  amountShippingMinor: minorAmountSchema,
  amountTaxMinor: minorAmountSchema,
  amountTotalMinor: minorAmountSchema,
  shippingName: z.string().nullable(),
  shippingAddress: merchantShippingAddressSnapshotSchema,
});
export type MerchantOrderAlertEmail = z.infer<typeof merchantOrderAlertEmailSchema>;

/** Optional env boundary for the ops recipient. Missing/empty → skip + log (non-fatal). */
export const merchantNotifyEmailEnvSchema = z
  .string()
  .trim()
  .pipe(z.email("MERCHANT_NOTIFY_EMAIL must be a valid email."));
export type MerchantNotifyEmail = z.infer<typeof merchantNotifyEmailEnvSchema>;
