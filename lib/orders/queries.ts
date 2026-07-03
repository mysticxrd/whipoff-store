import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatOrderNumber, parseOrderSeq } from "@/lib/contracts";
import { formatPrice } from "@/lib/money";
import type { OrderStatus } from "@/supabase/types";

// Owner-scoped order reads for the account surfaces — the ONE place account order history is
// fetched. Reads go through the anon session client (lib/supabase/server) so RLS scopes every row
// to the caller (orders_select_own / order_items_select_own, shipped by Slice 3); we ALSO filter
// on user_id explicitly (layered defense — action-level authorization, security_shield #5).
// Guest/unclaimed orders (user_id IS NULL) are invisible here until claim_guest_orders() attaches
// them. Order money is READ-ONLY and display-formatted via lib/money (integer minor units, never
// floats). Every function fails soft (empty list / null) so an offline/unconfigured Supabase
// degrades gracefully — same local-first posture as lib/cart/service.ts.

async function getUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null; // offline / unconfigured Supabase (local-first) — treat as no session
  }
}

/** One row in the order-history list. */
export type OrderSummaryView = {
  orderNumber: string; // WO-######
  status: OrderStatus;
  placedAt: string; // ISO created_at
  totalFormatted: string;
};

/** The caller's orders, newest first. Empty when signed out or unconfigured. */
export async function listMyOrders(): Promise<OrderSummaryView[]> {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);
    if (!userId) return [];

    const { data, error } = await supabase
      .from("orders")
      .select("order_seq, status, amount_total_minor, currency, created_at")
      .eq("user_id", userId) // explicit ownership; RLS re-enforces
      .order("created_at", { ascending: false });
    if (error || !data) return [];

    return data.map((o) => ({
      orderNumber: formatOrderNumber(o.order_seq),
      status: o.status,
      placedAt: o.created_at,
      totalFormatted: formatPrice(o.amount_total_minor, o.currency),
    }));
  } catch {
    return [];
  }
}

/** One line on the order-detail page. */
export type OrderItemView = {
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  unitPriceFormatted: string;
  lineTotalFormatted: string;
};

/** Full order detail (owner-scoped). */
export type OrderDetailView = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  paidAt: string | null;
  email: string;
  currency: string;
  subtotalFormatted: string;
  shippingFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  shippingName: string | null;
  shippingAddress: unknown; // Stripe-shaped json; formatted defensively at the view layer
  items: OrderItemView[];
};

/**
 * Fetch ONE of the caller's orders by its WO-###### number, or null (→ the page soft-404s).
 * The number is parsed to its order_seq and looked up under RLS + an explicit user_id filter:
 * a well-formed number for an order the caller does NOT own yields no row (the number is NOT an
 * authorization token — PRD Gate-1 #3), and a malformed number never hits the DB at all.
 */
export async function getMyOrderByNumber(
  orderNumber: string,
): Promise<OrderDetailView | null> {
  const seq = parseOrderSeq(orderNumber);
  if (seq === null) return null;

  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);
    if (!userId) return null;

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, order_seq, status, email, currency, amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor, shipping_name, shipping_address, paid_at, created_at",
      )
      .eq("user_id", userId) // explicit ownership; RLS re-enforces
      .eq("order_seq", seq)
      .maybeSingle();
    if (error || !order) return null;

    const { data: itemRows } = await supabase
      .from("order_items")
      .select(
        "product_title, variant_title, sku, unit_price_minor, line_total_minor, quantity, currency",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const items: OrderItemView[] = (itemRows ?? []).map((it) => ({
      productTitle: it.product_title,
      variantTitle: it.variant_title,
      sku: it.sku,
      quantity: it.quantity,
      unitPriceFormatted: formatPrice(it.unit_price_minor, it.currency),
      lineTotalFormatted: formatPrice(it.line_total_minor, it.currency),
    }));

    return {
      orderNumber: formatOrderNumber(order.order_seq),
      status: order.status,
      placedAt: order.created_at,
      paidAt: order.paid_at,
      email: order.email,
      currency: order.currency,
      subtotalFormatted: formatPrice(order.amount_subtotal_minor, order.currency),
      shippingFormatted: formatPrice(order.amount_shipping_minor, order.currency),
      taxFormatted: formatPrice(order.amount_tax_minor, order.currency),
      totalFormatted: formatPrice(order.amount_total_minor, order.currency),
      shippingName: order.shipping_name,
      shippingAddress: order.shipping_address,
      items,
    };
  } catch {
    return null;
  }
}
