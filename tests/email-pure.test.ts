import { describe, it, expect } from "vitest";
import {
  composeOrderConfirmationEmail,
  escapeHtml,
  renderOrderConfirmationEmail,
} from "@/lib/email/pure";
import type { Json } from "@/supabase/types";

// Slice 5 — pure compose/render core (authored at 03_verify, joins the change-set).
// No mocks: these modules are I/O-free by design.

const APP_URL = "https://store.test";

const baseOrder = {
  user_id: null as string | null,
  email: "buyer@example.com",
  currency: "INR",
  amount_subtotal_minor: 47000,
  amount_shipping_minor: 0,
  amount_tax_minor: 0,
  amount_total_minor: 47000,
  shipping_name: "Asha Kumar" as string | null,
  shipping_address: {
    line1: "12 MG Road",
    city: "Bengaluru",
    state: "KA",
    postal_code: "560001",
    country: "IN",
  } as Json,
  order_seq: 123,
  paid_at: "2026-07-03T10:00:00.000Z" as string | null,
  created_at: "2026-07-03T09:59:00.000Z",
};

const baseItems = [
  {
    product_title: "Whipoff Gloss Wash",
    variant_title: "500 ml",
    sku: "WGW-500" as string | null,
    unit_price_minor: 47000,
    quantity: 1,
    line_total_minor: 47000,
  },
];

function composed(overrides: Partial<typeof baseOrder> = {}, items = baseItems) {
  return composeOrderConfirmationEmail({ ...baseOrder, ...overrides }, items);
}

describe("composeOrderConfirmationEmail", () => {
  it("maps persisted rows to a strict receipt (guest, paid_at wins)", () => {
    const result = composed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.orderNumber).toBe("WO-000123");
    expect(result.receipt.isGuest).toBe(true);
    expect(result.receipt.placedAt).toBe(baseOrder.paid_at);
    expect(result.receipt.amountTotalMinor).toBe(47000);
    expect(result.receipt.lines).toHaveLength(1);
  });

  it("authenticated order: isGuest false, placedAt falls back to created_at", () => {
    const result = composed({ user_id: "user_abc", paid_at: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.isGuest).toBe(false);
    expect(result.receipt.placedAt).toBe(baseOrder.created_at);
  });

  it("fails closed on zero line items (never emails an empty receipt)", () => {
    const result = composed({}, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("lines");
  });

  it("fails closed on an invalid recipient email", () => {
    const result = composed({ email: "not-an-email" });
    expect(result.ok).toBe(false);
  });

  it("fails closed on a negative amount", () => {
    const result = composed({ amount_total_minor: -1 });
    expect(result.ok).toBe(false);
  });

  it("degrades a malformed shipping_address to null instead of failing (display-only)", () => {
    const result = composed({ shipping_address: "not an object" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.shippingAddress).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("neutralises markup-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'q'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;",
    );
  });
});

describe("renderOrderConfirmationEmail", () => {
  function receiptFor(overrides: Partial<typeof baseOrder> = {}, items = baseItems) {
    const result = composed(overrides, items);
    if (!result.ok) throw new Error(`fixture compose failed: ${result.reason}`);
    return result.receipt;
  }

  it("guest CTA is /sign-in only — never an order-detail or account link", () => {
    const rendered = renderOrderConfirmationEmail(receiptFor(), APP_URL);
    expect(rendered.html).toContain(`${APP_URL}/sign-in`);
    expect(rendered.text).toContain(`${APP_URL}/sign-in`);
    // AC 6: a guest email must expose NO route that could render order data without auth.
    expect(rendered.html).not.toContain("/account/orders");
    expect(rendered.text).not.toContain("/account/orders");
  });

  it("authenticated CTA is /account/orders (list route, no order id in the URL)", () => {
    const rendered = renderOrderConfirmationEmail(receiptFor({ user_id: "user_abc" }), APP_URL);
    expect(rendered.html).toContain(`${APP_URL}/account/orders`);
    expect(rendered.html).not.toContain(`${APP_URL}/account/orders/`);
    expect(rendered.html).not.toContain("/sign-in");
  });

  it("escapes hostile order-derived strings (stored-XSS-in-mail-client stays inert)", () => {
    const hostileItems = [
      {
        ...baseItems[0]!,
        product_title: `<script>alert("pwn")</script>`,
        variant_title: `"><img src=x onerror=alert(1)>`,
      },
    ];
    const rendered = renderOrderConfirmationEmail(
      receiptFor({ shipping_name: `<b onmouseover=alert(2)>Eve</b>` }, hostileItems),
      APP_URL,
    );
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).not.toContain("<b onmouseover");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("subject and body carry the order number; totals come from the receipt verbatim", () => {
    const rendered = renderOrderConfirmationEmail(receiptFor(), APP_URL);
    expect(rendered.subject).toBe("Your Whipoff order WO-000123 is confirmed");
    expect(rendered.html).toContain("WO-000123");
    expect(rendered.text).toContain("WO-000123");
    // INR formatting of the persisted total — never re-derived from lines.
    expect(rendered.text).toContain("Total: ");
  });

  it("omits the shipping block cleanly when address degraded to null and name is null", () => {
    const rendered = renderOrderConfirmationEmail(
      receiptFor({ shipping_address: null, shipping_name: null }),
      APP_URL,
    );
    expect(rendered.html).not.toContain("Shipping to");
    expect(rendered.text).not.toContain("Shipping to:");
  });
});
