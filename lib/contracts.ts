// Zod contracts — Slice 0 (auth + profile) + Slice 1 (catalog reads) + Slice 2 (cart mutations).
//
// SINGLE SOURCE OF TRUTH for input validation, shared by client (UX) and server
// (re-validation). See ../../shared/api_conventions.md and _config/security_shield.md
// flaw #3: the server MUST re-parse with these schemas before any side effect / query —
// client validation is UX only. Derive TS types via z.infer; never declare a parallel
// interface. Mirrors stages/01_data/output/contracts.ts.

import { z } from "zod";

// ===========================================================================
// Slice 0 — auth + profile
// ===========================================================================

/** Sign-in surface: email only (magic-link / OTP style). */
export const signInSchema = z.object({
  // Zod 4: normalize (trim/lowercase) then validate format via top-level z.email().
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Profile update: display name. Empty input clears it (maps to the nullable
 * profiles.display_name column).
 */
export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Keep your display name under 80 characters.")
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ===========================================================================
// Slice 1 — catalog read boundaries
// ===========================================================================
// Search params (PLP filter/sort/page) and route params (PDP slug) cross a trust boundary,
// so they are parsed server-side before any query. Two different tolerances:
//  - LIST query is LENIENT: a bad value degrades to the default so the grid still renders (AC#2).
//  - SLUG param is STRICT: a malformed slug can match no product → the PDP 404s.

/** URL-safe slug: lowercase alphanumeric segments joined by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug.");

/** PLP sort options. */
export const productSortSchema = z.enum(["newest", "price_asc", "price_desc"]);
export type ProductSort = z.infer<typeof productSortSchema>;

/**
 * PLP query, parsed from searchParams. Lenient by design (`.catch` fallbacks): unknown or
 * malformed values fall back to defaults rather than throwing, so the listing always renders.
 *  - `category`: optional slug; an invalid value is dropped (no filter).
 *  - `sort`: defaults to "newest".
 *  - `page`: 1-based; coerced from string; anything invalid → 1.
 */
export const productListQuerySchema = z.object({
  category: slugSchema.optional().catch(undefined),
  sort: productSortSchema.catch("newest"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** PDP route param. Strict: an invalid slug is treated as not-found by the page. */
export const productSlugSchema = z.object({
  slug: slugSchema,
});
export type ProductSlugParam = z.infer<typeof productSlugSchema>;

// ===========================================================================
// Slice 2 — cart mutations
// ===========================================================================
// Cart writes cross a trust boundary, so — unlike the LENIENT Slice-1 read queries — these are
// STRICT: an invalid variant id or quantity REJECTS with a typed error, never silently degrades.
// The same schema validates the client form (UX) and re-validates in the Server Action before any
// write (security_shield flaw #3). Price is NEVER an input — the server recomputes line and cart
// totals from the variant (glossary), so the client cannot influence money. Mutations key a line
// by its VARIANT (not a DB row id) so the identical contract serves both the signed-in DB cart and
// the guest httpOnly-cookie cart.

/** Soft cap on quantity per cart line (mirrored by the cart_items CHECK constraint). */
export const MAX_CART_ITEM_QUANTITY = 99;

/** A variant identifier (uuid). */
export const variantIdSchema = z.uuid("Invalid variant.");

/** Quantity for one cart line: whole number in [1, MAX]. Coerced from FormData strings. */
export const cartQuantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(MAX_CART_ITEM_QUANTITY, `Quantity can be at most ${MAX_CART_ITEM_QUANTITY}.`);

/** Add a variant to the cart (or increment its existing line). Quantity defaults to 1. */
export const addCartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: cartQuantitySchema.default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

/** Set the absolute quantity of an existing cart line. (Removal is a separate action.) */
export const updateCartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: cartQuantitySchema,
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/** Remove a line from the cart entirely. */
export const removeCartItemSchema = z.object({
  variantId: variantIdSchema,
});
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
