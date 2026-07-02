import "server-only";

import { cookies } from "next/headers";
import { parseGuestCartLines, type GuestCartLine } from "@/lib/cart/pure";

// The GUEST cart lives entirely in a server-managed httpOnly cookie — never in the DB (Checkpoint
// A decision, see supabase/migrations/20260702000000_cart.sql). Only `variantId` + `quantity` are
// stored (no price), so even a tampered cookie can't influence money: every read recomputes price
// live from the variant (security_shield flaw #3). Parsing itself is pure (lib/cart/pure.ts) so
// it's unit-tested without a request context; this module is just the next/headers plumbing.
const GUEST_CART_COOKIE = "wc_guest_cart";
const GUEST_CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type { GuestCartLine };

/**
 * Read + hydrate the guest cart cookie. LENIENT by design (unlike the strict mutation contracts):
 * a malformed cookie (tampered, truncated, stale shape) degrades to dropping the bad line rather
 * than throwing, so a corrupt cookie never breaks the page — mirrors the Slice-1 read posture.
 */
export async function readGuestCartLines(): Promise<GuestCartLine[]> {
  const raw = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return parseGuestCartLines(parsed);
}

/**
 * Persist the guest cart. Only callable from a Server Action / Route Handler (cookies().set()
 * throws/no-ops from a Server Component render — see lib/supabase/server.ts for the same
 * constraint on the Supabase session cookie).
 */
export async function writeGuestCartLines(lines: GuestCartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(GUEST_CART_COOKIE);
    return;
  }
  store.set(GUEST_CART_COOKIE, JSON.stringify(lines), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_MAX_AGE_SECONDS,
  });
}

/** Clear the guest cart cookie (after a successful merge into the signed-in user's cart). */
export async function clearGuestCart(): Promise<void> {
  (await cookies()).delete(GUEST_CART_COOKIE);
}
