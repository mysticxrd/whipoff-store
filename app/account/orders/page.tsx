import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listMyOrders } from "@/lib/orders/queries";
import {
  formatOrderDate,
  orderStatusBadgeVariant,
  orderStatusLabel,
} from "@/lib/orders/display";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order history" };

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense-in-depth: the proxy gateway already gates /account/*; re-check at the page (#5).
  if (!user) redirect("/sign-in?redirectTo=/account/orders");

  const orders = await listMyOrders();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <Link
            href="/account"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Account
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Order history</h1>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-foreground">You haven&apos;t placed any orders yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders you place will appear here.
            </p>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "default" }), "mt-4")}
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {order.orderNumber}
                      </span>
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatOrderDate(order.placedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold text-foreground">
                      {order.totalFormatted}
                    </span>
                    <ChevronRight
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
