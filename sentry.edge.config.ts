import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentryTransaction } from "@/lib/sentry-scrub";

// Edge-runtime Sentry. withSentryConfig injects the release; VERCEL_ENV distinguishes
// Preview from Production even though both execute with NODE_ENV=production.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryTransaction,
});
