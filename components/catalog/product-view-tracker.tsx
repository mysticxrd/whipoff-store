"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";

/** Fires `product_viewed` once on mount (PDP). Renders nothing. */
export function ProductViewTracker({
  productId,
  slug,
  valueMinor,
  currency,
}: {
  productId: string;
  slug: string;
  valueMinor: number;
  currency: string;
}) {
  useEffect(() => {
    analytics.productViewed({
      product_id: productId,
      product_slug: slug,
      value_minor: valueMinor,
      currency,
    });
  }, [productId, slug, valueMinor, currency]);

  return null;
}
