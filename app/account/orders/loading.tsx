import { Skeleton } from "@/components/ui/skeleton";

// Reserved layout mirrors the order-history list so the reveal doesn't shift (design_system.md
// "avoid layout shift"). Same loading.tsx posture the catalog slices established.
export default function OrdersLoading() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-5 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
