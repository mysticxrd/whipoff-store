import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  getResendApiKey: vi.fn<() => string | null>(),
  getEmailFrom: vi.fn(() => "Whipoff <onboarding@resend.dev>"),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env-server", () => env);

import { sendEmail } from "@/server/email/send";

const input = {
  idempotencyKey: "order-receipt/order_MNabc123XYZ",
  to: "buyer@example.com",
  subject: "Your Whipoff order WO-000123 is confirmed",
  html: "<p>receipt</p>",
  text: "receipt",
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  env.getEmailFrom.mockReturnValue("Whipoff <onboarding@resend.dev>");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendEmail", () => {
  it("skips without a configured key", async () => {
    env.getResendApiKey.mockReturnValue(null);
    await expect(sendEmail(input)).resolves.toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("contains malformed-key failures before any network call", async () => {
    env.getResendApiKey.mockImplementation(() => {
      throw new Error("Missing/invalid server env RESEND_API_KEY");
    });
    const result = await sendEmail(input);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the Resend request and returns its provider id", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_abc" }),
    });

    await expect(sendEmail(input)).resolves.toEqual({ ok: true, providerId: "email_abc" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_123");
    expect(init.headers["Idempotency-Key"]).toBe(input.idempotencyKey);
    expect(JSON.parse(init.body)).toEqual({
      from: "Whipoff <onboarding@resend.dev>",
      to: ["buyer@example.com"],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  });

  it("keeps the safe provider code but never leaks the provider message", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        name: "validation_error",
        message: "You can only send to private-recipient@example.com",
      }),
    });

    const result = await sendEmail(input);
    expect(result).toEqual({
      ok: false,
      reason: "resend_http_422_validation_error",
    });
    expect(JSON.stringify(result)).not.toContain("private-recipient");
  });

  it("drops malformed provider codes and falls back to status only", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ name: "bad code: buyer@example.com" }),
    });

    await expect(sendEmail(input)).resolves.toEqual({
      ok: false,
      reason: "resend_http_422",
    });
  });

  it("maps a network rejection to network_error", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(sendEmail(input)).resolves.toEqual({ ok: false, reason: "network_error" });
  });

  it("tolerates a successful response with an unparseable body", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(sendEmail(input)).resolves.toEqual({ ok: true, providerId: null });
  });
});
