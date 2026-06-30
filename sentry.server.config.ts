import * as Sentry from "@sentry/nextjs";

// Server-side Sentry. No-ops without a DSN (Slice 0 placeholder env). Source-map upload
// + withSentryConfig wrapping are added at cloud-wiring time (deploy runbook).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1,
  environment: process.env.NODE_ENV,
});
