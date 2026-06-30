import { describe, it, expect } from "vitest";
import { signInSchema, profileUpdateSchema } from "@/lib/contracts";

describe("signInSchema", () => {
  it("accepts and normalizes a valid email", () => {
    const r = signInSchema.safeParse({ email: "  USER@Example.com " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("maps empty/whitespace input to null", () => {
    const r = profileUpdateSchema.safeParse({ displayName: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.displayName).toBeNull();
  });

  it("trims a provided name", () => {
    const r = profileUpdateSchema.safeParse({ displayName: " Alex " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.displayName).toBe("Alex");
  });

  it("rejects names over 80 characters", () => {
    expect(
      profileUpdateSchema.safeParse({ displayName: "a".repeat(81) }).success,
    ).toBe(false);
  });
});
