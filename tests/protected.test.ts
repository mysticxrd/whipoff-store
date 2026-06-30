import { describe, it, expect } from "vitest";
import { isProtectedPath } from "@/lib/auth/protected";

describe("isProtectedPath", () => {
  it("protects /account and its subpaths", () => {
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/account/settings")).toBe(true);
  });

  it("leaves public routes open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
  });

  it("does not match on a shared prefix that isn't a path boundary", () => {
    // /accountant must NOT be treated as a subpath of /account
    expect(isProtectedPath("/accountant")).toBe(false);
  });
});
