"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";
import type { ProductSort } from "@/lib/contracts";

/** Fires `product_list_viewed` when the PLP (or a filter/sort change) renders. Renders nothing. */
export function ProductListTracker({
  category,
  sort,
  count,
}: {
  category: string | null;
  sort: ProductSort;
  count: number;
}) {
  useEffect(() => {
    analytics.productListViewed({ category, sort, count });
  }, [category, sort, count]);

  return null;
}
