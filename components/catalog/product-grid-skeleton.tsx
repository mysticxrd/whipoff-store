import { Skeleton } from "@/components/ui/skeleton";

// PLP results skeleton — mirrors <ProductResults> (count line + filter pills + product grid) so
// there's no layout shift when data streams in. Used as the INNER <Suspense> fallback on the PLP
// (not a route-level loading.tsx, which would wrap /products/[slug] and soft-404 the PDP).
export function ProductGridSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-4 w-20" />

      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-lg border border-border"
          >
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
