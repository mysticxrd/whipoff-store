import * as Sentry from "@sentry/nextjs";

// Edge-runtime Sentry. No-ops without a DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1,
  environment: process.env.NODE_ENV,
});
