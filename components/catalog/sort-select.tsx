"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductSort } from "@/lib/contracts";

const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/**
 * Sort control. Navigates by rewriting the URL (server re-parses & re-queries), preserving the
 * active category and resetting pagination. The server also re-validates the value, so this is
 * UX only — a tampered ?sort= still falls back to the default (productListQuerySchema).
 */
export function SortSelect({ sort }: { sort: ProductSort }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;
    if (value === "newest") params.delete("sort");
    else params.set("sort", value);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">Sort</span>
      <select
        value={sort}
        onChange={onChange}
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
