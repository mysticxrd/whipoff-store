import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Slice 5 — server/email/send.ts, the zero-dependency Resend fetch client.
// Contract under test: NEVER throws; not-configured short-circuits; status-only errors
// (a Resend response body must never leak into the reason string).

const env = vi.hoisted(() => ({
  getResendApiKey: vi.fn<() => string | null>(),
  getEmailFrom: vi.fn(() => "Whipoff <onboarding@resend.dev>"),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env-server", () => env);

import { sendEmail } from "@/server/email/send";

const input = {
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
  it("skips as not_configured when the key is absent — no network call", async () => {
    env.getResendApiKey.mockReturnValue(null);
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("contains a malformed-key throw as {ok:false} — no network call", async () => {
    env.getResendApiKey.mockImplementation(() => {
      throw new Error("Missing/invalid server env RESEND_API_KEY: must be re_…");
    });
    const result = await sendEmail(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("RESEND_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the Resend shape with Bearer auth and returns the provider id", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_abc" }),
    });
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: true, providerId: "email_abc" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      from: "Whipoff <onboarding@resend.dev>",
      to: ["buyer@example.com"],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  });

  it("maps a non-2xx to a status-only reason — response body never leaks", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "SECRET-ish provider detail" }),
    });
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: false, reason: "resend_http_422" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("maps a network rejection to network_error (never throws)", async () => {
    env.getResendApiKey.mockReturnValue("re_test_123");
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(sendEmail(input)).resolves.toEqual({ ok: false, reason: "network_error" });
  });

  it("tolerates a 2xx with an unparseable body (providerId null)", async () => {
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
