#!/usr/bin/env node

const requiresSentryUpload =
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "production";

if (requiresSentryUpload && !process.env.SENTRY_AUTH_TOKEN) {
  console.error(
    "Sentry source-map upload requires SENTRY_AUTH_TOKEN for Vercel Preview and Production builds.",
  );
  process.exitCode = 1;
}
