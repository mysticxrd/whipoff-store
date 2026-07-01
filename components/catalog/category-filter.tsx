import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProductSort } from "@/lib/contracts";
import type { Category } from "@/supabase/types";

// Category facets as link "pills". Server-rendered: each is a real <a> with a shareable URL,
// so filtering works without JS and the active filter is bookmarkable. Sort is preserved across
// filter changes; switching filter resets pagination (page is dropped from the URL).
function buildHref(categorySlug: string | null, sort: ProductSort): string {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (sort !== "newest") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/products?${qs}` : "/products";
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function CategoryFilter({
  categories,
  activeCategory,
  sort,
}: {
  categories: Category[];
  activeCategory: string | null;
  sort: ProductSort;
}) {
  return (
    <nav aria-label="Filter by category" className="-mx-4 px-4">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        <li>
          <Pill href={buildHref(null, sort)} active={activeCategory === null}>
            All
          </Pill>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Pill
              href={buildHref(category.slug, sort)}
              active={activeCategory === category.slug}
            >
              {category.name}
            </Pill>
          </li>
        ))}
      </ul>
    </nav>
  );
}
