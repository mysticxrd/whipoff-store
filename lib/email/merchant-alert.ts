// Merchant “new order” alert — PURE compose + render (no I/O, no secrets, no network).
// Mirror of lib/email/pure.ts for the ops packing sheet. Totals READ from the order row;
// money stays integer minor units until formatPrice at render. Order-derived strings pass
// through escapeHtml before HTML interpolation.

import {
  formatOrderNumber,
  merchantOrderAlertEmailSchema,
  type MerchantOrderAlertEmail,
} from "@/lib/contracts";
import { escapeHtml, type RenderedEmail } from "@/lib/email/pure";
import { formatPrice } from "@/lib/money";
import { formatOrderDate, formatShippingAddress } from "@/lib/orders/display";
import type { Order, OrderItem } from "@/supabase/types";

export type ComposeMerchantAlertResult =
  | { ok: true; alert: MerchantOrderAlertEmail }
  | { ok: false; reason: string };

function extractBuyerPhone(shippingAddress: unknown): string | null {
  if (shippingAddress === null || typeof shippingAddress !== "object") return null;
  const phone = (shippingAddress as Record<string, unknown>).phone;
  return typeof phone === "string" && phone.trim().length > 0 ? phone.trim() : null;
}

/**
 * Build the merchant packing-sheet contract from persisted order + line snapshots.
 * Strict parse except shipping_address (display-only `.catch(null)`).
 */
export function composeMerchantOrderAlert(
  order: Pick<
    Order,
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
  merchantEmail: string,
): ComposeMerchantAlertResult {
  const parsed = merchantOrderAlertEmailSchema.safeParse({
    orderNumber: formatOrderNumber(order.order_seq),
    merchantEmail,
    buyerEmail: order.email,
    buyerPhone: extractBuyerPhone(order.shipping_address),
    currency: order.currency,
    paidAt: order.paid_at ?? order.created_at,
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
      reason: issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "invalid alert",
    };
  }
  return { ok: true, alert: parsed.data };
}

// Inline-style palette for mail clients ONLY (same justified hardcode as customer receipt).
const INK = "#171717";
const MUTED = "#525252";
const RULE = "#e5e5e5";

/** Render ops packing sheet: subject + mobile-first HTML + plain-text fallback. */
export function renderMerchantOrderAlert(alert: MerchantOrderAlertEmail): RenderedEmail {
  const orderNo = alert.orderNumber;
  const paid = formatOrderDate(alert.paidAt);
  const money = (minor: number) => formatPrice(minor, alert.currency);
  const addressLines = formatShippingAddress(alert.shippingAddress);
  const totalDisplay = money(alert.amountTotalMinor);

  const lineRowsHtml = alert.lines
    .map((line) => {
      const title = escapeHtml(line.productTitle);
      const variant = escapeHtml(line.variantTitle);
      const sku = line.sku ? ` · SKU ${escapeHtml(line.sku)}` : "";
      return `<div style="padding:12px 0;border-bottom:1px solid ${RULE};">
  <div style="font-weight:600;color:${INK};">${title}</div>
  <div style="color:${MUTED};font-size:14px;">${variant}${sku} &middot; Qty ${line.quantity} &times; ${escapeHtml(money(line.unitPriceMinor))}</div>
  <div style="color:${INK};font-size:14px;margin-top:2px;">${escapeHtml(money(line.lineTotalMinor))}</div>
</div>`;
    })
    .join("\n");

  const totalsRow = (label: string, minor: number, strong = false) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;color:${strong ? INK : MUTED};${strong ? "font-weight:700;font-size:16px;" : "font-size:14px;"}"><span>${label}</span><span>${escapeHtml(money(minor))}</span></div>`;

  const contactHtml = `<div style="margin-top:24px;">
  <div style="font-weight:600;color:${INK};margin-bottom:4px;">Buyer</div>
  <div style="color:${MUTED};font-size:14px;">${escapeHtml(alert.buyerEmail)}</div>
  ${alert.buyerPhone ? `<div style="color:${MUTED};font-size:14px;">${escapeHtml(alert.buyerPhone)}</div>` : ""}
</div>`;

  const shippingHtml =
    addressLines.length > 0 || alert.shippingName
      ? `<div style="margin-top:16px;">
  <div style="font-weight:600;color:${INK};margin-bottom:4px;">Ship to</div>
  ${[alert.shippingName, ...addressLines]
    .filter((l): l is string => Boolean(l))
    .map((l) => `<div style="color:${MUTED};font-size:14px;">${escapeHtml(l)}</div>`)
    .join("\n  ")}
</div>`
      : "";

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px 24px;">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${INK};">Whipoff</div>
      <h1 style="font-size:22px;color:${INK};margin:20px 0 4px;">New order</h1>
      <p style="color:${MUTED};font-size:14px;margin:0;">
        Order <strong style="color:${INK};">${escapeHtml(orderNo)}</strong>${paid ? ` &middot; paid ${escapeHtml(paid)}` : ""}
        &middot; ${escapeHtml(totalDisplay)}
      </p>
      <div style="margin-top:16px;border-top:1px solid ${RULE};">
${lineRowsHtml}
      </div>
      <div style="margin-top:12px;">
        ${totalsRow("Subtotal", alert.amountSubtotalMinor)}
        ${totalsRow("Shipping", alert.amountShippingMinor)}
        ${totalsRow("Tax", alert.amountTaxMinor)}
        ${totalsRow("Total", alert.amountTotalMinor, true)}
      </div>
${contactHtml}
${shippingHtml}
    </div>
    <p style="color:${MUTED};font-size:12px;text-align:center;margin-top:16px;">
      Whipoff ops alert for ${escapeHtml(orderNo)}. Packing sheet only — not a customer receipt.
    </p>
  </div>
</body>
</html>`;

  const textLines = [
    `Whipoff — new order`,
    ``,
    `Order ${orderNo}${paid ? ` · paid ${paid}` : ""} · ${totalDisplay}`,
    ``,
    ...alert.lines.map(
      (line) =>
        `- ${line.productTitle} (${line.variantTitle}${line.sku ? `, SKU ${line.sku}` : ""}) — qty ${line.quantity} × ${money(line.unitPriceMinor)} = ${money(line.lineTotalMinor)}`,
    ),
    ``,
    `Subtotal: ${money(alert.amountSubtotalMinor)}`,
    `Shipping: ${money(alert.amountShippingMinor)}`,
    `Tax: ${money(alert.amountTaxMinor)}`,
    `Total: ${money(alert.amountTotalMinor)}`,
    ``,
    `Buyer: ${alert.buyerEmail}`,
    ...(alert.buyerPhone ? [`Phone: ${alert.buyerPhone}`] : []),
    ...(alert.shippingName || addressLines.length > 0
      ? ["", "Ship to:", ...[alert.shippingName, ...addressLines].filter(Boolean)]
      : []),
  ];

  return {
    subject: `New order #${orderNo} — ${totalDisplay}`,
    html,
    text: textLines.join("\n"),
  };
}
