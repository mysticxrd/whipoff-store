import Link from "next/link";
import { User } from "lucide-react";
import { CartTrigger } from "@/components/cart/cart-trigger";

/**
 * Global header — dark translucent forest bar (design: sticky, blurred).
 * Brand → home, "Shop" → catalog, account + cart affordances on the right.
 * The cart button (Slice 2) shows a live item count and opens the drawer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-green-950/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Whipoff home">
          <span className="font-display text-xl font-black tracking-tight text-white">
            Whipoff
          </span>
          <span className="block size-[7px] rounded-full bg-green-500" aria-hidden />
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/products"
            className="hidden min-h-11 items-center px-3 text-sm font-semibold text-green-100 transition-colors hover:text-white sm:inline-flex"
          >
            Shop
          </Link>
          <Link
            href="/account"
            aria-label="Your account"
            className="inline-flex size-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <User className="size-5" strokeWidth={1.8} />
          </Link>
          <CartTrigger />
        </nav>
      </div>
    </header>
  );
}
