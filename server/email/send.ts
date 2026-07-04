import "server-only";

import { getEmailFrom, getResendApiKey } from "@/lib/env-server";

// The ONE typed email client (_config/email.md) — server-only, webhook-path only this slice.
// Resend's send is a single HTTPS POST (https://resend.com/docs/api-reference/emails/send-email),
// so this is a typed fetch wrapper with ZERO new dependencies — the same no-new-package pattern
// lib/analytics-server.ts uses for PostHog capture, and the strictest reading of security-shield
// flaw #4 (nothing to pin, nothing to hallucinate). Swapping to the official `resend` SDK later
// is an Edit-Source change confined to this file (the exported shape wouldn't move).
//
// FAILURE-ISOLATED BY CONTRACT: this function NEVER throws. Every failure mode — key not
// configured (local mock posture), key malformed, non-2xx from Resend, network error — comes
// back as { ok: false, reason } for the caller to record. The webhook owes Stripe a 200 that no
// email problem may take away (PRD AC 4; email.md "a failed email never blocks order completion").

const RESEND_SEND_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; providerId: string | null }
  | { ok: false; reason: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let apiKey: string | null;
  try {
    apiKey = getResendApiKey(); // throws only on a PRESENT-but-malformed key (pointed message)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "invalid RESEND_API_KEY" };
  }
  if (!apiKey) {
    // Unconfigured (local/mock posture): recorded as a skip by the caller; orders unaffected.
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
      // Status only — never echo the response body into logs/errors (api_conventions.md:
      // no internals leaked; the body could quote our key context or recipient data).
      return { ok: false, reason: `resend_http_${response.status}` };
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
