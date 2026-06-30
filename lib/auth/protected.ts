/** Route prefixes that require an authenticated session (the auth gateway). */
export const PROTECTED_PREFIXES = ["/account"];

/** True when `path` is a protected route or one of its subpaths. */
export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
