import { z } from "zod";

/**
 * Client-safe environment — NEXT_PUBLIC_* ONLY. Safe to import from client or server
 * code: it contains NO secrets (security_shield.md flaw #1). Server secrets (e.g. the
 * Supabase service-role key, the Razorpay key secret) are never read here — they live in
 * the dedicated `server-only` module (lib/env-server.ts).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  // Razorpay KEY ID only (the publishable half — the browser needs it to open Standard
  // Checkout; it grants nothing without the server-side key secret). Optional so builds stay
  // green before keys arrive — /checkout renders a "payments not configured" state instead
  // (mirrors the optional-PostHog posture). rzp_test_ enforced: TEST MODE ONLY this slice —
  // going live is a separate approval + Edit-Source of this constraint (payments.md).
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z
    .string()
    .startsWith("rzp_test_", "Razorpay key id must be a TEST key (rzp_test_…) this slice")
    .optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  NEXT_PUBLIC_GA4_ID: z.string().min(1).optional(),
});

// Next inlines NEXT_PUBLIC_* only for literal `process.env.X` references — list each.
const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid client environment variables — see .env.example:\n${details}`,
  );
}

export const clientEnv = parsed.data;
