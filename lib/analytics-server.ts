import "server-only";

import { clientEnv } from "@/lib/env";

// Server-side analytics (observability.md: authoritative events — orders, revenue — are
// captured SERVER-side to avoid ad-blocker loss). No new dependency: PostHog's /capture
// endpoint is plain HTTP, and the project key is the same publishable NEXT_PUBLIC_ value the
// client uses (not a secret). Every event ALSO emits one structured log line, so the local
// no-PostHog posture still leaves an audit trail (webhook evidence for 03_verify).

type EventProps = Record<string, string | number | boolean | null | undefined>;

export async function captureServerEvent(
  event: string,
  props: EventProps,
  distinctId?: string,
): Promise<void> {
  console.log(JSON.stringify({ source: "server-analytics", event, ...props }));

  const key = clientEnv.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  try {
    await fetch(`${clientEnv.NEXT_PUBLIC_POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId ?? "server",
        properties: props,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics must never take down the caller (the webhook especially) — logged above.
  }
}
