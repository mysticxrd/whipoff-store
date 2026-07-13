import Link from "next/link";
import { User } from "lucide-react";
import { CartTrigger } from "@/components/cart/cart-trigger";

/**
 * Global header — matches the source landing design's nav exactly:
 * Fraunces-black wordmark with the gold dot (left), the primary section links
 * centered (≥lg, with the gold underline-on-hover), and an account icon + cart
 * on the right. Kept sticky + frosted (ink/80, blur) so it stays in normal flow
 * across the multi-page store rather than overlapping page content.
 *
 * The account icon (→ /account) sits beside the cart as a matching circular
 * icon button. The top announcement bar was dropped to match the source design.
 */
const NAV_LINKS = [
  { href: "/#formula", label: "Formula" },
  { href: "/#gloss", label: "Gloss Lab" },
  { href: "/#ritual", label: "Ritual" },
  { href: "/#logbook", label: "Logbook" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-bone/10 bg-ink/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-[var(--nav-h)] items-center justify-between gap-4 px-[var(--gutter)]">
        <Link
          href="/"
          aria-label="Whipoff home"
          className="font-display text-[1.35rem] font-black tracking-[0.01em] text-bone"
        >
          WHIPOFF<span className="text-gold">.</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden gap-[34px] text-[0.95rem] font-[460] lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative py-1.5 text-bone/80 transition-colors hover:text-bone"
            >
              {link.label}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px origin-right scale-x-0 bg-gold transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:origin-left group-hover:scale-x-100"
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/account"
            aria-label="Account"
            className="grid size-11 place-items-center rounded-full text-bone/90 transition-colors hover:bg-bone/10 hover:text-bone"
          >
            <User className="size-5" strokeWidth={1.8} />
          </Link>
          <CartTrigger />
        </div>
      </div>
    </header>
  );
}
