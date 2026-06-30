// Zod contracts — Slice 0 (auth + profile).
//
// SINGLE SOURCE OF TRUTH for input validation, shared by client (UX) and server
// (re-validation). See ../../shared/api_conventions.md and _config/security_shield.md
// flaw #3: the server MUST re-parse with these schemas before any side effect.
// Mirrors stages/01_data/output/contracts.ts.

import { z } from "zod";

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
