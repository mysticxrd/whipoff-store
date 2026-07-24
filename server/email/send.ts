import "server-only";

import { getEmailFrom, getResendApiKey } from "@/lib/env-server";

const RESEND_SEND_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  idempotencyKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; providerId: string | null }
  | { ok: false; reason: string };

/**
 * Resend's documented error `name` is a bounded machine code such as
 * `validation_error`. Keep it when present so Preview failures are actionable, while
 * deliberately discarding the provider message because it may contain recipient/sender PII.
 */
function safeProviderErrorCode(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || !("name" in payload)) return null;
  const name = (payload as { name: unknown }).name;
  return typeof name === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(name) ? name : null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let apiKey: string | null;
  try {
    apiKey = getResendApiKey();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "invalid RESEND_API_KEY" };
  }
  if (!apiKey) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const providerCode = safeProviderErrorCode(payload);
      return {
        ok: false,
        reason: `resend_http_${response.status}${providerCode ? `_${providerCode}` : ""}`,
      };
    }

    const payload: unknown = await response.json().catch(() => null);
    const providerId =
      payload !== null &&
      typeof payload === "object" &&
      "id" in payload &&
      typeof (payload as { id: unknown }).id === "string"
        ? (payload as { id: string }).id
        : null;
    return { ok: true, providerId };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
