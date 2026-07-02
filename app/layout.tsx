import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@/components/analytics/ga";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getCart } from "@/lib/cart/service";

// Brand type: Inter for UI/body, Fraunces (variable serif) for display headings.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Whipoff — Car Care", template: "%s · Whipoff" },
  description: "Hydroilx™ pH-neutral, ceramic-safe car shampoo. Mobile-first car-care essentials.",
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
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <CartProvider initialCart={cart}>
            <AnnouncementBar />
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
