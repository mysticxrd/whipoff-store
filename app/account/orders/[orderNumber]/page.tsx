import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrderByNumber } from "@/lib/orders/queries";
import {
  formatOrderDate,
  formatShippingAddress,
  orderStatusBadgeVariant,
  orderStatusLabel,
} from "@/lib/orders/display";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber}` };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense-in-depth: the proxy gateway already gates /account/*; re-check at the page (#5).
  if (!user) redirect(`/sign-in?redirectTo=/account/orders/${orderNumber}`);

  const order = await getMyOrderByNumber(orderNumber);
  // Soft-404: a malformed number OR a valid number the caller doesn't own (RLS yielded no row).
  // The order number is display-only — it never grants access; ownership does (PRD Gate-1 #3).
  if (!order) notFound();

  const addressLines = formatShippingAddress(order.shippingAddress);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <Link
            href="/account/orders"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Order history
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
            <Badge variant={orderStatusBadgeVariant(order.status)}>
              {orderStatusLabel(order.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed {formatOrderDate(order.placedAt)} · {order.email}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items recorded.</p>
            ) : (
              <ul className="space-y-4">
                {order.items.map((item, i) => (
                  <li
                    key={`${item.sku ?? item.variantTitle}-${i}`}
                    className="flex justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{item.productTitle}</p>
                      <p className="text-sm text-muted-foreground">{item.variantTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.unitPriceFormatted} × {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium text-foreground">
                      {item.lineTotalFormatted}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Subtotal" value={order.subtotalFormatted} />
            <SummaryRow label="Shipping" value={order.shippingFormatted} />
            <SummaryRow label="Tax" value={order.taxFormatted} />
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{order.totalFormatted}</span>
            </div>
          </CardContent>
        </Card>

        {order.shippingName || addressLines.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {order.shippingName ? (
                <p className="font-medium text-foreground">{order.shippingName}</p>
              ) : null}
              {addressLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
