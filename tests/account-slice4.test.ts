import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  formatOrderNumber,
  parseOrderSeq,
  orderNumberSchema,
  accountOrderParamSchema,
  isSafeReturnTo,
  safeReturnTo,
  returnToSchema,
  authCallbackSchema,
  DEFAULT_RETURN_TO,
  ORDER_NUMBER_PREFIX,
} from "@/lib/contracts";
import {
  orderStatusLabel,
  orderStatusBadgeVariant,
  formatOrderDate,
  formatShippingAddress,
} from "@/lib/orders/display";

// ============================================================================
// Slice 4 — account + order history + guest claim (offline pure-logic unit
// tests; the mock-posture backbone per PRD Gate-1 #5). The three security-
// load-bearing surfaces get adversarial coverage: the open-redirect guard, the
// order-number parser (a display string, never an authz token), and the email
// normalizer (aligned with the SQL claim matcher for ASCII-clean inputs — Finding 2).
// ============================================================================

// ---- normalizeEmail (TS side of the claim matcher) -------------------------
// The guest-claim matches on SQL lower(btrim(o.email, <ASCII ws>)) = the identically
// normalized auth.email(); normalizeEmail is the TS PREVIEW of that key ("we found N
// orders"). ALIGNED at Gate 4 (Finding 2 fix): the SQL matcher's btrim set was widened
// to JS trim()'s ASCII subset (space \t \n \r \f \v), so both sides agree on any
// ASCII-clean input — which is all we accept (orders.email = Stripe
// customer_details.email, auth.email() = GoTrue-issued). Accepted residual: JS trim()
// also strips Unicode whitespace and .toLowerCase() can diverge from Postgres lower()
// on locale glyphs — unreachable with provider emails, documented in the audit §6.
describe("normalizeEmail (TS claim-preview contract)", () => {
  it("lowercases and trims ASCII-space outer whitespace (agrees with SQL)", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("USER@WHIPOFF.IN")).toBe("user@whipoff.in");
  });

  it("strips tab/newline — now also stripped by the aligned SQL matcher (Finding-2 fix)", () => {
    // JS .trim() removes \t and \n; post-fix, SQL btrim(email, E' \t\n\r\f\x0B') does too.
    expect(normalizeEmail("\t person@example.com \n")).toBe("person@example.com");
  });

  it("is idempotent (claiming twice normalizes the same key)", () => {
    const once = normalizeEmail("  MixEd@Case.io ");
    expect(normalizeEmail(once)).toBe(once);
  });
});

// ---- formatOrderNumber / parseOrderSeq --------------------------------------
describe("formatOrderNumber", () => {
  it("zero-pads to six digits with the WO- prefix", () => {
    expect(formatOrderNumber(1)).toBe("WO-000001");
    expect(formatOrderNumber(123)).toBe("WO-000123");
    expect(formatOrderNumber(999999)).toBe("WO-999999");
  });

  it("widens past six digits instead of truncating", () => {
    expect(formatOrderNumber(1000000)).toBe("WO-1000000");
  });

  it("rejects non-positive / non-integer seq (guards a DB invariant break)", () => {
    expect(() => formatOrderNumber(0)).toThrow();
    expect(() => formatOrderNumber(-3)).toThrow();
    expect(() => formatOrderNumber(1.5)).toThrow();
    expect(() => formatOrderNumber(NaN)).toThrow();
  });
});

describe("parseOrderSeq (round-trip + soft-404 gate)", () => {
  it("round-trips formatOrderNumber", () => {
    for (const seq of [1, 42, 123, 999999, 1000000]) {
      expect(parseOrderSeq(formatOrderNumber(seq))).toBe(seq);
    }
  });

  it("is case/space tolerant on entry (URL or hand-typed)", () => {
    expect(parseOrderSeq("wo-000123")).toBe(123);
    expect(parseOrderSeq("  WO-000123  ")).toBe(123);
  });

  it("returns null for anything malformed (never reaches the DB → soft-404)", () => {
    for (const bad of [
      "",
      "WO-",
      "WO-12",             // < 6 digits
      "WO-12345",          // 5 digits
      "123456",            // no prefix
      "WO-12x456",         // non-digit
      "WO-000123; DROP",   // injection-shaped
      "ORDER-000123",      // wrong prefix
      "WO-000123/../../x",
    ]) {
      expect(parseOrderSeq(bad)).toBeNull();
    }
  });

  it("the parsed number is NOT an authorization token — parse succeeds regardless of ownership", () => {
    // parseOrderSeq only validates SHAPE. Ownership is enforced downstream by
    // RLS + the explicit .eq('user_id') filter (see lib/orders/queries.ts).
    expect(parseOrderSeq("WO-000001")).toBe(1);
    expect(parseOrderSeq("WO-999999")).toBe(999999);
  });
});

describe("orderNumberSchema / accountOrderParamSchema", () => {
  it("normalizes case + trims via the schema", () => {
    expect(orderNumberSchema.parse(" wo-000777 ")).toBe("WO-000777");
  });
  it("rejects malformed route params", () => {
    expect(accountOrderParamSchema.safeParse({ orderNumber: "nope" }).success).toBe(
      false,
    );
    expect(
      accountOrderParamSchema.safeParse({ orderNumber: "WO-001000" }).success,
    ).toBe(true);
  });
  it("exposes a stable display prefix", () => {
    expect(ORDER_NUMBER_PREFIX).toBe("WO-");
  });
});

// ---- open-redirect guard (isSafeReturnTo / safeReturnTo) --------------------
// Guarded at three call sites (sign-in page, sign-in action, /auth/callback);
// isSafeReturnTo is the single source of truth. Attack the usual escapes.
describe("open-redirect guard", () => {
  it("accepts same-origin absolute paths", () => {
    for (const ok of [
      "/account",
      "/account/orders",
      "/account/orders/WO-000123",
      "/sign-in",
      "/",
      "/a/b/c?x=1&y=2",
    ]) {
      expect(isSafeReturnTo(ok)).toBe(true);
      expect(safeReturnTo(ok)).toBe(ok);
    }
  });

  it("rejects protocol-relative and backslash-tricked hosts", () => {
    for (const bad of ["//evil.com", "//evil.com/path", "/\\evil.com", "/\\/evil.com"]) {
      expect(isSafeReturnTo(bad)).toBe(false);
      expect(safeReturnTo(bad)).toBe(DEFAULT_RETURN_TO);
    }
  });

  it("rejects absolute URLs with a scheme", () => {
    for (const bad of [
      "https://evil.com",
      "http://evil.com",
      "javascript:alert(1)",
      "data:text/html,x",
      "mailto:x@y.z",
      "HTTPS://EVIL.COM",
    ]) {
      expect(isSafeReturnTo(bad)).toBe(false);
      expect(safeReturnTo(bad)).toBe(DEFAULT_RETURN_TO);
    }
  });

  it("rejects relative (non-slash-leading) values", () => {
    for (const bad of ["account", "../etc", "./x", "evil.com"]) {
      expect(isSafeReturnTo(bad)).toBe(false);
    }
  });

  it("rejects control chars a browser could normalize into scheme+host", () => {
    // Build literal control bytes numerically so no control char sits in source.
    const nl = String.fromCharCode(0x0a);
    const cr = String.fromCharCode(0x0d);
    const tab = String.fromCharCode(0x09);
    const nul = String.fromCharCode(0x00);
    const del = String.fromCharCode(0x7f);
    expect(isSafeReturnTo(`/foo${nl}//evil.com`)).toBe(false);
    expect(isSafeReturnTo(`/foo${cr}bar`)).toBe(false);
    expect(isSafeReturnTo(`/foo${tab}bar`)).toBe(false);
    expect(isSafeReturnTo(`/foo${nul}`)).toBe(false);
    expect(isSafeReturnTo(`/foo${del}`)).toBe(false);
  });

  it("rejects empty / whitespace / non-string inputs, falling back to /account", () => {
    expect(isSafeReturnTo("")).toBe(false);
    expect(safeReturnTo("")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("   ")).toBe(DEFAULT_RETURN_TO); // returnToSchema trims → empty → unsafe
    expect(safeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(42)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(["/account"])).toBe(DEFAULT_RETURN_TO);
  });

  it("returnToSchema rejects unsafe targets", () => {
    expect(returnToSchema.safeParse("//evil.com").success).toBe(false);
    expect(returnToSchema.safeParse("/account/orders").success).toBe(true);
  });

  it("DEFAULT_RETURN_TO is itself a safe target (no fallback loop)", () => {
    expect(isSafeReturnTo(DEFAULT_RETURN_TO)).toBe(true);
  });
});

// ---- authCallbackSchema -----------------------------------------------------
// Trimmed at Gate 4 (Finding 3): /auth/callback implements the PKCE `code` flow only,
// so the schema no longer carries the unreachable token_hash/type/next branch and the
// destination field is `redirectTo` (matching the route), not `next`.
describe("authCallbackSchema (PKCE-only callback contract)", () => {
  it("accepts a PKCE code, with or without a redirectTo", () => {
    expect(authCallbackSchema.safeParse({ code: "abc123" }).success).toBe(true);
    expect(
      authCallbackSchema.safeParse({ code: "abc123", redirectTo: "/account" }).success,
    ).toBe(true);
  });
  it("rejects a missing or empty code", () => {
    expect(authCallbackSchema.safeParse({}).success).toBe(false);
    expect(authCallbackSchema.safeParse({ code: "" }).success).toBe(false);
    expect(authCallbackSchema.safeParse({ redirectTo: "/account" }).success).toBe(false);
  });
  it("the retired OTP branch no longer parses (token_hash is not a callback token)", () => {
    expect(
      authCallbackSchema.safeParse({ token_hash: "h", type: "magiclink" }).success,
    ).toBe(false);
  });
});

// ---- display helpers --------------------------------------------------------
describe("orderStatusLabel / orderStatusBadgeVariant", () => {
  const cases = [
    ["pending", "Pending", "muted"],
    ["paid", "Paid", "default"],
    ["fulfilled", "Fulfilled", "secondary"],
    ["refunded", "Refunded", "outline"],
    ["cancelled", "Cancelled", "destructive"],
  ] as const;

  it("maps every order_status enum member to a label + token badge variant", () => {
    for (const [status, label, variant] of cases) {
      expect(orderStatusLabel(status)).toBe(label);
      expect(orderStatusBadgeVariant(status)).toBe(variant);
    }
  });

  it("falls back safely for an unknown status (forward-compat)", () => {
    // @ts-expect-error — deliberately off-enum to prove the runtime fallback.
    expect(orderStatusLabel("bogus")).toBe("Pending");
    // @ts-expect-error — deliberately off-enum.
    expect(orderStatusBadgeVariant("bogus")).toBe("muted");
  });
});

describe("formatOrderDate", () => {
  it("renders a non-empty en-IN date for a valid ISO string", () => {
    expect(formatOrderDate("2026-07-03T10:20:30Z").length).toBeGreaterThan(0);
  });
  it("returns empty string for an invalid date (never throws in the view)", () => {
    expect(formatOrderDate("not-a-date")).toBe("");
    expect(formatOrderDate("")).toBe("");
  });
});

describe("formatShippingAddress (defensive against Stripe json)", () => {
  it("returns [] for non-object shapes (never throws)", () => {
    expect(formatShippingAddress(null)).toEqual([]);
    expect(formatShippingAddress(undefined)).toEqual([]);
    expect(formatShippingAddress("oops")).toEqual([]);
    expect(formatShippingAddress(42)).toEqual([]);
    expect(formatShippingAddress({})).toEqual([]);
  });

  it("formats a full address and drops an empty line2", () => {
    expect(
      formatShippingAddress({
        line1: "12 MG Rd",
        line2: "",
        city: "Pune",
        state: "MH",
        postal_code: "411001",
        country: "IN",
      }),
    ).toEqual(["12 MG Rd", "Pune, MH, 411001", "IN"]);
  });

  it("ignores unknown / non-string fields and whitespace-only values", () => {
    expect(
      formatShippingAddress({
        line1: "Flat 4",
        city: "Goa",
        country: "IN",
        junk: 5,
        nested: { a: 1 },
      }),
    ).toEqual(["Flat 4", "Goa", "IN"]);
    expect(formatShippingAddress({ city: "  ", state: "KA" })).toEqual(["KA"]);
  });
});
