import Script from "next/script";
import { clientEnv } from "@/lib/env";

/** GA4 (marketing analytics). Renders nothing unless NEXT_PUBLIC_GA4_ID is set. */
export function GoogleAnalytics() {
  const id = clientEnv.NEXT_PUBLIC_GA4_ID;
  if (!id) return null;

  // Debug mode only marks Preview traffic for immediate provider-side DebugView
  // verification. Production continues to use normal GA4 collection.
  const previewDebug = process.env.VERCEL_ENV === "preview";

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{debug_mode:${previewDebug}});`}
      </Script>
    </>
  );
}
