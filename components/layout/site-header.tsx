import Link from "next/link";
import { User } from "lucide-react";
import { CartTrigger } from "@/components/cart/cart-trigger";

/**
 * Global header — design v2 nav: translucent ink bar, blurred, hairline bottom
 * border; Fraunces black wordmark with the gold dot.
 * Brand → home, "Shop" → catalog, account + cart affordances on the right.
 * The cart button (Slice 2) shows a live item count and opens the drawer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-bone/10 bg-ink/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5">
        <Link href="/" className="flex items-center" aria-label="Whipoff home">
          <span className="font-display text-xl font-black tracking-tight text-bone">
            WHIPOFF<span className="text-gold">.</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/products"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-bone/80 transition-colors hover:text-bone sm:inline-flex"
          >
            Shop
          </Link>
          <Link
            href="/account"
            aria-label="Your account"
            className="inline-flex size-11 items-center justify-center rounded-full text-bone/80 transition-colors hover:bg-bone/10 hover:text-bone"
          >
            <User className="size-5" strokeWidth={1.8} />
          </Link>
          <CartTrigger />
        </nav>
      </div>
    </header>
  );
}
