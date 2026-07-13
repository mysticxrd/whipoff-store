import "server-only";

import { z } from "zod";

// Server-side secrets — the counterpart to lib/env.ts (which is NEXT_PUBLIC_* only).
// `server-only` guarantees none of this can be imported into a client bundle
// (security_shield.md flaw #1). Each secret is parsed LAZILY at first use, not at module
// load, so builds and non-payment pages stay green before keys are configured — only the
// code path that actually needs a secret fails, with a pointed message.
//
// TEST MODE ONLY this slice (payments.md): the rzp_test_ prefix on the PUBLIC key id
// (lib/env.ts) is the mode gate — Razorpay key secrets are unprefixed random strings, so the
// secret schema can only enforce presence/length, and a live secret paired with a test key id
// fails at Razorpay's own auth. Going live is a deliberate Edit-Source change behind the
// verify gate + explicit approval.

const razorpayKeySecretSchema = z
  .string()
  .min(16, "RAZORPAY_KEY_SECRET looks too short to be a Razorpay key secret");

const razorpayWebhookSecretSchema = z
  .string()
  .min(8, "RAZORPAY_WEBHOOK_SECRET is the secret you typed when creating the webhook");

const supabaseServiceRoleKeySchema = z
  .string()
  .min(1, "SUPABASE_SERVICE_ROLE_KEY is required for the payment webhook order write");

// Slice 5 (email): Resend key shape. re_ is Resend's only key prefix (test vs live is a
// domain/sandbox distinction, not a key prefix — the sandbox posture is enforced by the
// placeholder onboarding@resend.dev sender below until 04_ship verifies a domain).
const resendApiKeySchema = z
  .string()
  .startsWith("re_", "RESEND_API_KEY must be a Resend API key (re_…)");

function parseSecret<T>(schema: z.ZodType<T>, name: string, value: string | undefined): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "invalid value";
    throw new Error(`Missing/invalid server env ${name}: ${message} — see .env.example`);
  }
  return parsed.data;
}

/**
 * Razorpay key SECRET — the private half of the API key pair. Used for Orders API basic auth
 * and for the checkout-callback HMAC (lib/razorpay.ts is the only consumer). Never NEXT_PUBLIC_.
 */
export function getRazorpayKeySecret(): string {
  return parseSecret(
    razorpayKeySecretSchema,
    "RAZORPAY_KEY_SECRET",
    process.env.RAZORPAY_KEY_SECRET,
  );
}

/** Razorpay webhook signing secret (raw-body HMAC verification, payments.md). */
export function getRazorpayWebhookSecret(): string {
  return parseSecret(
    razorpayWebhookSecretSchema,
    "RAZORPAY_WEBHOOK_SECRET",
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );
}

/** Supabase service-role key — used ONLY by the webhook's order write (lib/supabase/admin.ts). */
export function getSupabaseServiceRoleKey(): string {
  return parseSecret(
    supabaseServiceRoleKeySchema,
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Resend API key (Slice 5, server/email/send.ts — the only consumer). OPTIONAL by design:
 * `null` = email not configured (the local/mock posture — sends are recorded as skipped and
 * orders are unaffected, PRD failure isolation). A PRESENT but malformed key throws the usual
 * pointed error; that throw is contained inside the failure-isolated email path.
 */
export function getResendApiKey(): string | null {
  const raw = process.env.RESEND_API_KEY;
  if (raw === undefined || raw === "") return null;
  return parseSecret(resendApiKeySchema, "RESEND_API_KEY", raw);
}

// PRD Gate-1 #6 (human-set): PLACEHOLDER sender until the domain is verified at 04_ship.
// onboarding@resend.dev is Resend's built-in sandbox sender (works with any key, delivers only
// to the account owner's inbox) — the email twin of the rzp_test_ posture. The real verified
// `orders@…` sender is a 04_ship env change, not a code change.
const DEFAULT_EMAIL_FROM = "Whipoff <onboarding@resend.dev>";

/** Sender identity for transactional email. Not a secret, but a server-only concern. */
export function getEmailFrom(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  return raw !== undefined && raw !== "" ? raw : DEFAULT_EMAIL_FROM;
}
