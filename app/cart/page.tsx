import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cart" };

/**
 * Placeholder cart route. The real cart drawer/page (line items, quantity edit,
 * free-shipping progress) is built in the Cart slice (Slice 2). This exists so the
 * global header's cart affordance has a valid target in the meantime.
 */
export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-green-50 text-green-600">
        <ShoppingCart className="size-7" strokeWidth={1.7} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-black text-foreground">
        Your garage is empty.
      </h1>
      <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
        The cart arrives in the next slice. For now, browse the catalog and line up
        your foam.
      </p>
      <Link href="/products" className={`${buttonVariants({ size: "lg" })} mt-6`}>
        Shop Whipoff
      </Link>
    </main>
  );
}
