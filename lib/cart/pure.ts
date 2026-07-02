// Pure cart logic — quantity clamping, guest-cookie payload parsing, and cart-totals math.
//
// Deliberately has NO "server-only" import and NO I/O (no next/headers, no Supabase client), so
// it is unit-testable without a request context — mirroring lib/catalog/select.ts vs queries.ts
// (Slice 1). lib/cart/cookie.ts and lib/cart/service.ts are thin server-only wrappers around this.

import { MAX_CART_ITEM_QUANTITY, variantIdSchema } from "@/lib/contracts";
import { computeShippingMinor, FREE_SHIP_THRESHOLD_MINOR } from "@/lib/money";

export type GuestCartLine = { variantId: string; quantity: number };

export type CartLineView = {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  imageUrl: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  inStock: boolean;
};

export type CartView = {
  lines: CartLineView[];
  itemCount: number;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  freeShipThresholdMinor: number;
  freeShipRemainingMinor: number;
};

/** Clamp a quantity into [1, MAX_CART_ITEM_QUANTITY] (mirrors the cart_items CHECK constraint). */
export function clampQuantity(quantity: number): number {
  return Math.min(MAX_CART_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/**
 * Lenient parse of a JSON.parse'd guest-cart cookie payload: drops malformed/duplicate lines
 * rather than throwing, so a tampered or stale cookie never breaks the page (mirrors the
 * Slice-1 LENIENT read posture — contracts.ts's cart schemas stay STRICT for mutations).
 */
export function parseGuestCartLines(parsed: unknown): GuestCartLine[] {
  if (!Array.isArray(parsed)) return [];
  const lines: GuestCartLine[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const variantId = variantIdSchema.safeParse((entry as Record<string, unknown>).variantId);
    const quantity = Number((entry as Record<string, unknown>).quantity);
    if (!variantId.success || !Number.isFinite(quantity) || seen.has(variantId.data)) continue;
    seen.add(variantId.data);
    lines.push({ variantId: variantId.data, quantity: clampQuantity(quantity) });
  }
  return lines;
}

/** Aggregate already-resolved lines into cart totals (subtotal/shipping/total/free-ship progress). */
export function buildCartView(lines: CartLineView[]): CartView {
  const currency = lines[0]?.currency ?? "INR";
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const shippingMinor = lines.length > 0 ? computeShippingMinor(subtotalMinor) : 0;
  return {
    lines,
    itemCount,
    currency,
    subtotalMinor,
    shippingMinor,
    totalMinor: subtotalMinor + shippingMinor,
    freeShipThresholdMinor: FREE_SHIP_THRESHOLD_MINOR,
    freeShipRemainingMinor: Math.max(0, FREE_SHIP_THRESHOLD_MINOR - subtotalMinor),
  };
}
