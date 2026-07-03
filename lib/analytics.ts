// Catalog analytics — thin, env-gated wrapper over PostHog (observability.md taxonomy).
//
// Mirrors the Slice-0 posture (app/providers.tsx): PostHog initializes ONLY when a key is
// configured, so every capture here is a safe no-op without a key (and during SSR). Imported
// by client components only. Event props are kept stable for downstream funnels.

import posthog from "posthog-js";
import { clientEnv } from "@/lib/env";

const enabled = Boolean(clientEnv.NEXT_PUBLIC_POSTHOG_KEY);

type EventProps = Record<string, string | number | boolean | null | undefined>;

function capture(event: string, props?: EventProps): void {
  if (!enabled || typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(event, props);
}

type ListViewedProps = {
  category: string | null;
  sort: string;
  count: number;
};

type ProductViewedProps = {
  product_id: string;
  product_slug: string;
  value_minor: number;
  currency: string;
};

type VariantSelectedProps = {
  product_id: string;
  variant_id: string;
  value_minor: number;
  currency: string;
};

type CartViewedProps = {
  cart_value_minor: number;
  currency: string;
  item_count: number;
};

type CartLineEventProps = {
  product_id: string;
  variant_id: string;
  quantity: number;
  value_minor: number;
  currency: string;
  cart_value_minor: number;
};

// checkout_started fires client-side at checkout entry (funnel edge); the authoritative
// payment_succeeded / order_completed events are SERVER-side (lib/analytics-server.ts,
// fired by the webhook) so revenue never depends on the shopper's ad-blocker.
type CheckoutStartedProps = {
  cart_value_minor: number;
  currency: string;
  item_count: number;
};

export const analytics = {
  productListViewed(props: ListViewedProps): void {
    capture("product_list_viewed", props);
  },
  productViewed(props: ProductViewedProps): void {
    capture("product_viewed", props);
  },
  variantSelected(props: VariantSelectedProps): void {
    capture("variant_selected", props);
  },
  cartViewed(props: CartViewedProps): void {
    capture("cart_viewed", props);
  },
  cartItemAdded(props: CartLineEventProps): void {
    capture("cart_item_added", props);
  },
  cartQuantityUpdated(props: CartLineEventProps): void {
    capture("cart_quantity_updated", props);
  },
  cartItemRemoved(props: CartLineEventProps): void {
    capture("cart_item_removed", props);
  },
  checkoutStarted(props: CheckoutStartedProps): void {
    capture("checkout_started", props);
  },
};
