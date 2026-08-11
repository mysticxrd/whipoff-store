import type { Metadata } from "next";
import { Archivo, Fraunces, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@/components/analytics/ga";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getCart } from "@/lib/cart/service";

// Brand type (design v2): Archivo for UI/body, Fraunces (variable serif, with the
// opsz/SOFT/WONK axes the design's font-variation-settings rely on) for display,
// Space Mono for instrument/spec labels.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Whipoff — Car Care", template: "%s · Whipoff" },
  description: "Hydroslick™ pH-neutral, ceramic-safe car shampoo. Mobile-first car-care essentials.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Server-fetched so the header count + drawer are correct on first paint (no empty-cart
  // flash); CartProvider then owns all further reads/writes client-side (Slice 2).
  const cart = await getCart();

  return (
    <html
      lang="en"
      // The <Preloader>'s parser-run inline script sets data-wo-loading on <html>
      // before React hydrates (to gate the hero intro without a flash), so the
      // real DOM legitimately differs from this server markup. Suppress the
      // expected attribute mismatch — this applies only to <html>'s own
      // attributes, not the tree below, so real mismatches still surface.
      suppressHydrationWarning
      className={`${archivo.variable} ${fraunces.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Film grain — fixed decorative overlay (design v2); filter defs feed .grain */}
        <svg className="absolute" width="0" height="0" aria-hidden>
          <filter id="grain-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div className="grain" aria-hidden />
        <SmoothScroll />
        <Providers>
          <CartProvider initialCart={cart}>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
            <CartDrawer />
          </CartProvider>
        </Providers>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
