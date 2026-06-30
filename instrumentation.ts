import * as Sentry from "@sentry/nextjs";

// Next.js native instrumentation hook — loads the right Sentry config per runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward nested React Server Component / route errors to Sentry (no-op without DSN).
export const onRequestError = Sentry.captureRequestError;
