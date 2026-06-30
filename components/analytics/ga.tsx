import Script from "next/script";
import { clientEnv } from "@/lib/env";

/** GA4 (marketing analytics). Renders nothing unless NEXT_PUBLIC_GA4_ID is set. */
export function GoogleAnalytics() {
  const id = clientEnv.NEXT_PUBLIC_GA4_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
