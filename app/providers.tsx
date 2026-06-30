"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { clientEnv } from "@/lib/env";

const posthogKey = clientEnv.NEXT_PUBLIC_POSTHOG_KEY;

/** Product analytics (PostHog). Initializes only when a key is configured. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!posthogKey || posthog.__loaded) return;
    posthog.init(posthogKey, {
      api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, []);

  if (!posthogKey) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
