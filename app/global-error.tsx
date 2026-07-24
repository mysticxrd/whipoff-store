"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
          <h1 className="font-display text-3xl">Something went wrong.</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t load this page. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
