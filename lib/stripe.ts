import "server-only";

import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env-server";

// Server-side Stripe client — lazy singleton so importing this module never demands the
// secret key at build time (mirrors lib/env-server.ts's lazy posture). apiVersion is pinned
// to the version the installed SDK (stripe@22.3.0, tech_stack.md) targets, so runtime
// behavior can't drift under us when the account's default version changes.

const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

let singleton: Stripe | null = null;

/** The one Stripe client. Secret key is read (and validated as sk_test_) on first call. */
export function getStripe(): Stripe {
  if (!singleton) {
    singleton = new Stripe(getStripeSecretKey(), {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return singleton;
}
