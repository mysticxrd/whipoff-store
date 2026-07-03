import "server-only";

import { z } from "zod";

// Server-side secrets — the counterpart to lib/env.ts (which is NEXT_PUBLIC_* only).
// `server-only` guarantees none of this can be imported into a client bundle
// (security_shield.md flaw #1). Each secret is parsed LAZILY at first use, not at module
// load, so builds and non-payment pages stay green before keys are configured — only the
// code path that actually needs a secret fails, with a pointed message.
//
// TEST KEYS ONLY this slice (payments.md): the sk_test_ prefix is enforced by the schema
// itself. Going live is a deliberate Edit-Source change behind the verify gate + explicit
// approval — a live key pasted into .env.local fails validation by design.

const stripeSecretKeySchema = z
  .string()
  .startsWith("sk_test_", "STRIPE_SECRET_KEY must be a TEST key (sk_test_…) this slice");

const stripeWebhookSecretSchema = z
  .string()
  .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must be a webhook signing secret (whsec_…)");

const supabaseServiceRoleKeySchema = z
  .string()
  .min(1, "SUPABASE_SERVICE_ROLE_KEY is required for the Stripe webhook order write");

function parseSecret<T>(schema: z.ZodType<T>, name: string, value: string | undefined): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "invalid value";
    throw new Error(`Missing/invalid server env ${name}: ${message} — see .env.example`);
  }
  return parsed.data;
}

/** Stripe secret key (session creation + webhook verification). Server-only, test-mode enforced. */
export function getStripeSecretKey(): string {
  return parseSecret(stripeSecretKeySchema, "STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
}

/** Stripe webhook signing secret (raw-body signature verification, payments.md). */
export function getStripeWebhookSecret(): string {
  return parseSecret(
    stripeWebhookSecretSchema,
    "STRIPE_WEBHOOK_SECRET",
    process.env.STRIPE_WEBHOOK_SECRET,
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
