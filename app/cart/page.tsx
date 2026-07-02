import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OpenCartDrawer } from "@/components/cart/open-cart-drawer";

export const metadata: Metadata = { title: "Cart" };

/**
 * /cart is a thin fallback for the header's cart affordance (Slice 2): the cart itself lives in
 * the slide-out drawer, not a second full-page surface. Visiting this route opens the drawer over
 * the page below; the static content here is only what a visitor sees before hydration (or if JS
 * fails), so the link is never a dead end.
 */
export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <OpenCartDrawer />
      <div className="grid size-16 place-items-center rounded-full bg-green-50 text-green-600">
        <ShoppingCart className="size-7" strokeWidth={1.7} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-black text-foreground">
        Your cart lives in the drawer.
      </h1>
      <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
        Tap the cart icon up top — or browse the catalog and line up your foam.
      </p>
      <Link href="/products" className={`${buttonVariants({ size: "lg" })} mt-6`}>
        Shop Whipoff
      </Link>
    </main>
  );
}
