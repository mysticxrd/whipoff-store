import type { ZodError } from "zod";

// Typed result shape for Server Actions (shared/api_conventions.md). Never throw raw
// errors across the boundary — map to this shape. `fieldErrors` drives inline form display.
export type ActionErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "auth"
  | "db"
  | "unknown";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: ActionError };

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionError): ActionResult<never> {
  return { ok: false, error };
}

/** Build field errors from a ZodError. Version-agnostic (reads `.issues`). */
export function fieldErrorsFromZod(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
