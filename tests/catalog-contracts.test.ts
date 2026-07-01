import { describe, it, expect } from "vitest";
import { productListQuerySchema, productSlugSchema } from "@/lib/contracts";

describe("productListQuerySchema (lenient — bad values degrade to defaults)", () => {
  it("applies defaults for empty input", () => {
    expect(productListQuerySchema.parse({})).toEqual({
      category: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("falls back to the default sort for an unknown value", () => {
    expect(productListQuerySchema.parse({ sort: "bogus" }).sort).toBe("newest");
  });

  it("accepts each valid sort", () => {
    expect(productListQuerySchema.parse({ sort: "price_asc" }).sort).toBe("price_asc");
    expect(productListQuerySchema.parse({ sort: "price_desc" }).sort).toBe("price_desc");
  });

  it("coerces page from a string and clamps invalid input to 1", () => {
    expect(productListQuerySchema.parse({ page: "3" }).page).toBe(3);
    expect(productListQuerySchema.parse({ page: "abc" }).page).toBe(1);
    expect(productListQuerySchema.parse({ page: "0" }).page).toBe(1);
  });

  it("drops a malformed category slug but keeps (and normalizes) a valid one", () => {
    expect(productListQuerySchema.parse({ category: "bad slug!" }).category).toBeUndefined();
    expect(productListQuerySchema.parse({ category: "Wheels-Tyres" }).category).toBe(
      "wheels-tyres",
    );
  });
});

describe("productSlugSchema (strict — drives 404)", () => {
  it("accepts a well-formed slug", () => {
    expect(productSlugSchema.safeParse({ slug: "ceramic-spray-wax" }).success).toBe(true);
  });

  it("rejects slugs with spaces or empty input", () => {
    expect(productSlugSchema.safeParse({ slug: "bad slug" }).success).toBe(false);
    expect(productSlugSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
