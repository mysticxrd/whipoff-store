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
};
