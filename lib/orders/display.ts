// Order display helpers — PURE + unit-testable (no I/O). The offline-testable "pure logic" the
// 03_verify mock posture leans on (PRD Slice-4 Gate-1 #5), same footing as contracts.ts helpers.
// Turns an order's stored enum / timestamps / shipping json into display text + token-mapped badge
// variants. NO money math here — that stays in lib/money.ts (integer minor units only).

import type { OrderStatus } from "@/supabase/types";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

// Human label for an order status (the enum is lower-case; the UI shows title case).
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status] ?? "Pending";
}

// Map status → a token-only Badge variant (no hardcoded colors; design_system.md).
const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: "muted",
  paid: "default",
  fulfilled: "secondary",
  refunded: "outline",
  cancelled: "destructive",
};

export function orderStatusBadgeVariant(status: OrderStatus): BadgeVariant {
  return STATUS_VARIANT[status] ?? "muted";
}

/** Format an ISO timestamp as a short, locale-grouped order date (INR posture → en-IN). */
export function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Best-effort, defensive formatter for orders.shipping_address (a Stripe-shaped JSON blob, so
 * treated as `unknown` on re-entry — flaw #3). Returns the present address lines in postal order;
 * an unexpected shape yields an empty list rather than throwing. Never trusts keys blindly — reads
 * only a known allow-list of string fields.
 */
export function formatShippingAddress(raw: unknown): string[] {
  if (raw === null || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = obj[k];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  };
  const cityLine = [str("city"), str("state"), str("postal_code")]
    .filter((v): v is string => v !== null)
    .join(", ");
  return [str("line1"), str("line2"), cityLine || null, str("country")].filter(
    (v): v is string => v !== null && v.length > 0,
  );
}
