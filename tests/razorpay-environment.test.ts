import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ clientEnv: {} }));

import {
  getRazorpayKeyIdForMode,
  getRazorpayMode,
  getRazorpaySecretNames,
} from "@/lib/env-server";

describe("Razorpay deployment separation", () => {
  it("uses Vercel's deployment class rather than NODE_ENV", () => {
    expect(getRazorpayMode("production")).toBe("live");
    expect(getRazorpayMode("preview")).toBe("test");
    expect(getRazorpayMode("development")).toBe("test");
    expect(getRazorpayMode(undefined)).toBe("test");
  });

  it("accepts a live key only in Production", () => {
    expect(getRazorpayKeyIdForMode("rzp_live_abc123", "live")).toBe("rzp_live_abc123");
    expect(() => getRazorpayKeyIdForMode("rzp_live_abc123", "test")).toThrow(/rzp_test_/);
  });

  it("accepts a test key only outside Production", () => {
    expect(getRazorpayKeyIdForMode("rzp_test_abc123", "test")).toBe("rzp_test_abc123");
    expect(() => getRazorpayKeyIdForMode("rzp_test_abc123", "live")).toThrow(/rzp_live_/);
  });

  it("fails closed when a checkout key is absent", () => {
    expect(() => getRazorpayKeyIdForMode(undefined, "test")).toThrow(/missing/);
    expect(() => getRazorpayKeyIdForMode(undefined, "live")).toThrow(/missing/);
  });

  it("selects distinct key and webhook secret names for each mode", () => {
    expect(getRazorpaySecretNames("test")).toEqual({
      keySecret: "RAZORPAY_TEST_KEY_SECRET",
      webhookSecret: "RAZORPAY_TEST_WEBHOOK_SECRET",
    });
    expect(getRazorpaySecretNames("live")).toEqual({
      keySecret: "RAZORPAY_LIVE_KEY_SECRET",
      webhookSecret: "RAZORPAY_LIVE_WEBHOOK_SECRET",
    });
  });
});
