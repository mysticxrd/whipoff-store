// Order-confirmation email — PURE compose + render (no I/O, no secrets, no network).
// The offline-testable core the 03_verify mock posture leans on (PRD Slice-5 Assumptions), same
// footing as lib/cart/pure.ts and lib/checkout/pure.ts:
//   * compose: persisted orders/order_items rows → the receipt contract (STRICT Zod parse via
//     orderConfirmationEmailSchema — a composition bug fails loudly here, before anything sends,
//     rather than emailing garbage). Totals are READ from the order row, never re-derived (PRD
//     reuse rule); money stays integer minor units until formatPrice at render.
//   * render: receipt → { subject, html, text }. Email clients are their own rendering context
//     (design_system.md caveat in the PRD): single-column table-free layout, INLINE styles only
//     (web tokens/Tailwind never reach a mail client), plain-text fallback (email.md). Every
//     order-derived string passes through escapeHtml — order data (titles, shipping fields)
//     originates from Stripe-captured input and MUST NOT be interpolated raw into markup.
// Deliberately NOT a React Email component (email.md names them): one template, zero new
// dependencies, and a pure string renderer is directly unit-testable offline — surfaced at the
// build gate; promote via Edit-Source if/when a second template arrives.

import {
  formatOrderNumber,
  orderConfirmationEmailSchema,
  type OrderConfirmationEmail,
} from "@/lib/contracts";
import { formatPrice } from "@/lib/money";
import { formatOrderDate, formatShippingAddress } from "@/lib/orders/display";
import type { Order, OrderItem } from "@/supabase/types";

export type ComposeReceiptResult =
  | { ok: true; receipt: OrderConfirmationEmail }
  | { ok: false; reason: string };

/**
 * Build the receipt contract from the PERSISTED order + line-item snapshots (the webhook's
 * service-role read). Strict parse: any missing/invalid field (no lines, bad email, negative
 * amount) fails the whole compose — the caller records it as a permanent failure, it never
 * half-sends. Only shipping_address degrades gracefully (schema `.catch(null)`): display-only,
 * so a malformed blob drops the address block instead of dropping the receipt.
 */
export function composeOrderConfirmationEmail(
  order: Pick<
    Order,
    | "user_id"
    | "email"
    | "currency"
    | "amount_subtotal_minor"
    | "amount_shipping_minor"
    | "amount_tax_minor"
    | "amount_total_minor"
    | "shipping_name"
    | "shipping_address"
    | "order_seq"
    | "paid_at"
    | "created_at"
  >,
  items: Pick<
    OrderItem,
    "product_title" | "variant_title" | "sku" | "unit_price_minor" | "quantity" | "line_total_minor"
  >[],
): ComposeReceiptResult {
  const parsed = orderConfirmationEmailSchema.safeParse({
    orderNumber: formatOrderNumber(order.order_seq),
    recipientEmail: order.email,
    currency: order.currency,
    placedAt: order.paid_at ?? order.created_at,
    isGuest: order.user_id === null,
    lines: items.map((item) => ({
      productTitle: item.product_title,
      variantTitle: item.variant_title,
      sku: item.sku,
      unitPriceMinor: item.unit_price_minor,
      quantity: item.quantity,
      lineTotalMinor: item.line_total_minor,
    })),
    amountSubtotalMinor: order.amount_subtotal_minor,
    amountShippingMinor: order.amount_shipping_minor,
    amountTaxMinor: order.amount_tax_minor,
    amountTotalMinor: order.amount_total_minor,
    shippingName: order.shipping_name,
    shippingAddress: order.shipping_address,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "invalid receipt",
    };
  }
  return { ok: true, receipt: parsed.data };
}

/** Minimal HTML entity escape for order-derived strings interpolated into the template. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type RenderedEmail = { subject: string; html: string; text: string };

// Inline-style palette for mail clients ONLY (justified hardcode: design tokens are CSS variables
// that email clients strip — the PRD's "different rendering context" note). AA on white.
const INK = "#171717";
const MUTED = "#525252";
const RULE = "#e5e5e5";

/**
 * Render the receipt into subject + mobile-first HTML + plain-text fallback.
 * Guest vs authenticated changes ONLY the CTA (PRD AC 2/6): guest → /sign-in invite (the Slice-4
 * verified claim attaches their orders on sign-in — never a detail deep link that would show
 * order data without auth); authenticated → /account/orders. Both are EXISTING routes.
 */
export function renderOrderConfirmationEmail(
  receipt: OrderConfirmationEmail,
  appUrl: string,
): RenderedEmail {
  const orderNo = receipt.orderNumber;
  const placed = formatOrderDate(receipt.placedAt);
  const ctaHref = receipt.isGuest ? `${appUrl}/sign-in` : `${appUrl}/account/orders`;
  const ctaLabel = receipt.isGuest ? "Sign in to track your order" : "View your orders";
  const ctaNote = receipt.isGuest
    ? "Sign in with this email address and this order will be waiting in your account."
    : "This order is already in your account.";
  const addressLines = formatShippingAddress(receipt.shippingAddress);

  const money = (minor: number) => formatPrice(minor, receipt.currency);

  const lineRowsHtml = receipt.lines
    .map((line) => {
      const title = escapeHtml(line.productTitle);
      const variant = escapeHtml(line.variantTitle);
      return `<div style="padding:12px 0;border-bottom:1px solid ${RULE};">
  <div style="font-weight:600;color:${INK};">${title}</div>
  <div style="color:${MUTED};font-size:14px;">${variant} &middot; Qty ${line.quantity} &times; ${escapeHtml(money(line.unitPriceMinor))}</div>
  <div style="color:${INK};font-size:14px;margin-top:2px;">${escapeHtml(money(line.lineTotalMinor))}</div>
</div>`;
    })
    .join("\n");

  const totalsRow = (label: string, minor: number, strong = false) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;color:${strong ? INK : MUTED};${strong ? "font-weight:700;font-size:16px;" : "font-size:14px;"}"><span>${label}</span><span>${escapeHtml(money(minor))}</span></div>`;

  const shippingHtml =
    addressLines.length > 0 || receipt.shippingName
      ? `<div style="margin-top:24px;">
  <div style="font-weight:600;color:${INK};margin-bottom:4px;">Shipping to</div>
  ${[receipt.shippingName, ...addressLines]
    .filter((l): l is string => Boolean(l))
    .map((l) => `<div style="color:${MUTED};font-size:14px;">${escapeHtml(l)}</div>`)
    .join("\n  ")}
</div>`
      : "";

  // Single column, max 560px, tap-friendly CTA (44px+), semantic headings, alt text — the
  // PRD's "mobile-first in a mail client" reading.
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px 24px;">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${INK};">Whipoff</div>
      <h1 style="font-size:22px;color:${INK};margin:20px 0 4px;">Order confirmed</h1>
      <p style="color:${MUTED};font-size:14px;margin:0;">
        Order <strong style="color:${INK};">${escapeHtml(orderNo)}</strong>${placed ? ` &middot; ${escapeHtml(placed)}` : ""}
      </p>
      <p style="color:${MUTED};font-size:14px;line-height:1.5;">
        Thanks for your order — your payment went through and we&#39;re getting it ready.
      </p>
      <div style="margin-top:16px;border-top:1px solid ${RULE};">
${lineRowsHtml}
      </div>
      <div style="margin-top:12px;">
        ${totalsRow("Subtotal", receipt.amountSubtotalMinor)}
        ${totalsRow("Shipping", receipt.amountShippingMinor)}
        ${totalsRow("Tax", receipt.amountTaxMinor)}
        ${totalsRow("Total", receipt.amountTotalMinor, true)}
      </div>
${shippingHtml}
      <a href="${escapeHtml(ctaHref)}"
         style="display:block;text-align:center;background:${INK};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 20px;border-radius:8px;margin-top:28px;">${escapeHtml(ctaLabel)}</a>
      <p style="color:${MUTED};font-size:13px;line-height:1.5;margin-top:12px;">${escapeHtml(ctaNote)}</p>
    </div>
    <p style="color:${MUTED};font-size:12px;text-align:center;margin-top:16px;">
      Whipoff &middot; This is your order receipt for ${escapeHtml(orderNo)}. Reply to this email if anything looks wrong.
    </p>
  </div>
</body>
</html>`;

  const textLines = [
    `Whipoff — order confirmed`,
    ``,
    `Order ${orderNo}${placed ? ` · ${placed}` : ""}`,
    `Thanks for your order — your payment went through and we're getting it ready.`,
    ``,
    ...receipt.lines.map(
      (line) =>
        `- ${line.productTitle} (${line.variantTitle}) — qty ${line.quantity} × ${money(line.unitPriceMinor)} = ${money(line.lineTotalMinor)}`,
    ),
    ``,
    `Subtotal: ${money(receipt.amountSubtotalMinor)}`,
    `Shipping: ${money(receipt.amountShippingMinor)}`,
    `Tax: ${money(receipt.amountTaxMinor)}`,
    `Total: ${money(receipt.amountTotalMinor)}`,
    ...(receipt.shippingName || addressLines.length > 0
      ? ["", "Shipping to:", ...[receipt.shippingName, ...addressLines].filter(Boolean)]
      : []),
    ``,
    `${ctaLabel}: ${ctaHref}`,
    ctaNote,
  ];

  return {
    subject: `Your Whipoff order ${orderNo} is confirmed`,
    html,
    text: textLines.join("\n"),
  };
}
