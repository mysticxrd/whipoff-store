import "server-only";

import { z } from "zod";
import { clientEnv } from "@/lib/env";

// Server-side secrets — the counterpart to lib/env.ts (which is NEXT_PUBLIC_* only).
// `server-only` guarantees none of this can be imported into a client bundle
// (security_shield.md flaw #1). Each secret is parsed LAZILY at first use, not at module
// load, so builds and non-payment pages stay green before keys are configured.

export type RazorpayMode = "test" | "live";

const razorpayKeySecretSchema = z
  .string()
  .min(16, "Razorpay key secret looks too short");

const razorpayWebhookSecretSchema = z
  .string()
  .min(8, "Razorpay webhook secret looks too short");

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
 * Production is the sole deployment class that can use live Razorpay credentials. Vercel
 * supplies VERCEL_ENV as `production` only for Production deployments; local development and
 * every Preview deployment deliberately resolve to test mode. Never use NODE_ENV here: Next
 * sets it to `production` for Preview builds too.
 */
export function getRazorpayMode(vercelEnv: string | undefined = process.env.VERCEL_ENV): RazorpayMode {
  return vercelEnv === "production" ? "live" : "test";
}

/** Environment-variable names are mode-specific: no generic secret can cross environments. */
export function getRazorpaySecretNames(mode: RazorpayMode): {
  keySecret: "RAZORPAY_TEST_KEY_SECRET" | "RAZORPAY_LIVE_KEY_SECRET";
  webhookSecret: "RAZORPAY_TEST_WEBHOOK_SECRET" | "RAZORPAY_LIVE_WEBHOOK_SECRET";
} {
  return mode === "live"
    ? {
        keySecret: "RAZORPAY_LIVE_KEY_SECRET",
        webhookSecret: "RAZORPAY_LIVE_WEBHOOK_SECRET",
      }
    : {
        keySecret: "RAZORPAY_TEST_KEY_SECRET",
        webhookSecret: "RAZORPAY_TEST_WEBHOOK_SECRET",
      };
}

/**
 * Bind the publishable key ID to the authoritative deployment class. A Preview with a copied
 * rzp_live_ ID, or Production with a stale rzp_test_ ID, fails closed before any provider call.
 */
export function getRazorpayKeyIdForMode(
  keyId: string | undefined,
  mode: RazorpayMode,
): string {
  if (!keyId) {
    throw new Error("Razorpay is not configured (NEXT_PUBLIC_RAZORPAY_KEY_ID missing)");
  }
  const requiredPrefix = mode === "live" ? "rzp_live_" : "rzp_test_";
  if (!keyId.startsWith(requiredPrefix)) {
    throw new Error(
      `Razorpay ${mode} mode requires NEXT_PUBLIC_RAZORPAY_KEY_ID to start with ${requiredPrefix}`,
    );
  }
  return keyId;
}

/** The only server-approved publishable key ID for this deployment. */
export function getRazorpayKeyId(): string {
  return getRazorpayKeyIdForMode(clientEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID, getRazorpayMode());
}

/**
 * Razorpay key secret — selected only by the Vercel deployment class and never exposed to the
 * client. Test and live deployments intentionally use different variable names.
 */
export function getRazorpayKeySecret(): string {
  const { keySecret } = getRazorpaySecretNames(getRazorpayMode());
  const value =
    keySecret === "RAZORPAY_LIVE_KEY_SECRET"
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_TEST_KEY_SECRET;
  return parseSecret(razorpayKeySecretSchema, keySecret, value);
}

/**
 * Validate the complete Orders API credential pair before any checkout-side effect. Returning
 * only the public key ID prevents a caller from accidentally carrying a private value onward.
 * Checkout/session staging must call this before it creates an admin client or writes shopper
 * data: a missing or mis-scoped secret is a configuration failure, not a payment attempt.
 */
export function assertRazorpayOrderCredentialsConfigured(): string {
  const keyId = getRazorpayKeyId();
  getRazorpayKeySecret();
  return keyId;
}

/** Raw-body webhook secret, selected using the same strict deployment binding as the key pair. */
export function getRazorpayWebhookSecret(): string {
  const { webhookSecret } = getRazorpaySecretNames(getRazorpayMode());
  const value =
    webhookSecret === "RAZORPAY_LIVE_WEBHOOK_SECRET"
      ? process.env.RAZORPAY_LIVE_WEBHOOK_SECRET
      : process.env.RAZORPAY_TEST_WEBHOOK_SECRET;
  return parseSecret(razorpayWebhookSecretSchema, webhookSecret, value);
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
const DEFAULT_EMAIL_FROM = "Whipoff <onboarding@resend.dev>";

/** Sender identity for transactional email. Not a secret, but a server-only concern. */
export function getEmailFrom(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  return raw !== undefined && raw !== "" ? raw : DEFAULT_EMAIL_FROM;
}
