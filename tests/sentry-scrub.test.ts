import { describe, expect, it } from "vitest";
import type { ErrorEvent, Event } from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentryTransaction } from "@/lib/sentry-scrub";

describe("scrubSentryEvent", () => {
  it("removes user PII, request bodies/cookies, and sensitive nested keys", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "receipt failed for buyer@example.com",
      user: { id: "user_1", email: "buyer@example.com", ip_address: "203.0.113.4" },
      request: {
        method: "POST",
        url: "https://store.test/auth/callback?code=private-code#fragment",
        headers: {
          authorization: "Bearer private-token",
          "user-agent": "test-agent",
        },
        cookies: { session: "private" },
        data: { email: "buyer@example.com" },
      },
      extra: {
        shipping_address: "12 Private Road",
        nested: { phone: "9876543210", safe: "order_123" },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.user).toEqual({ id: "user_1" });
    expect(scrubbed.request).toEqual({
      method: "POST",
      url: "https://store.test/auth/callback",
      headers: {
        authorization: "[Filtered]",
        "user-agent": "test-agent",
      },
    });
    expect(scrubbed.message).toBe("receipt failed for [Filtered]");
    expect(scrubbed.extra).toEqual({
      shipping_address: "[Filtered]",
      nested: { phone: "[Filtered]", safe: "order_123" },
    });
  });

  it("scrubs breadcrumb and exception strings", () => {
    const scrubbed = scrubSentryEvent({
      type: undefined,
      breadcrumbs: [{ message: "buyer@example.com", data: { apiKey: "secret" } }],
      exception: {
        values: [{ type: "Error", value: "Bearer private-token for buyer@example.com" }],
      },
    });

    expect(scrubbed.breadcrumbs?.[0]?.message).toBe("[Filtered]");
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ apiKey: "[Filtered]" });
    expect(scrubbed.exception?.values?.[0]?.value).toBe("Bearer [Filtered] for [Filtered]");
  });

  it("scrubs transaction names, span descriptions, and span data", () => {
    const event: Event = {
      type: "transaction",
      transaction: "/auth/callback?code=private-code",
      spans: [
        {
          span_id: "0123456789abcdef",
          trace_id: "0123456789abcdef0123456789abcdef",
          start_timestamp: 1,
          timestamp: 2,
          description: "GET /checkout?email=buyer@example.com",
          data: { email: "buyer@example.com", safe: "order_123" },
        },
      ],
    };

    const scrubbed = scrubSentryTransaction(event);

    expect(scrubbed.transaction).toBe("/auth/callback");
    expect(scrubbed.spans?.[0]?.description).toBe("GET /checkout");
    expect(scrubbed.spans?.[0]?.data).toEqual({
      email: "[Filtered]",
      safe: "order_123",
    });
  });
});
