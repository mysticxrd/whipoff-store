import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentryTransaction } from "@/lib/sentry-scrub";

// Client-side Sentry init. NEXT_PUBLIC_DEPLOY_ENV contains only the non-sensitive
// Vercel environment label injected by next.config.ts at build time.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1,
  environment: process.env.NEXT_PUBLIC_DEPLOY_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryTransaction,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
