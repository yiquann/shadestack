import { describe, expect, it } from "vitest";
import { parseAndValidateProductQuery, applyProductQuery } from "./queryParams";
import type { CatalogProduct } from "./types";

const PRODUCTS: CatalogProduct[] = [
  { id: "1", category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "a" },
  { id: "2", category: "LIPSTICK", name: "Lip Glow Balm", brand: "Dior", shade: "004 Coral", colorHex: "#E37B6D", price: 40, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "b" },
  { id: "3", category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "c" },
];

describe("parseAndValidateProductQuery", () => {
  it("accepts a valid category", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("category=LIPSTICK"));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.query.category).toBe("LIPSTICK");
  });

  it("rejects an invalid category", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("category=NOT_REAL"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("Invalid category");
  });

  it("parses minPrice and maxPrice as numbers", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("minPrice=10&maxPrice=50"));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.query.minPrice).toBe(10);
      expect(result.query.maxPrice).toBe(50);
    }
  });

  it("rejects a non-numeric minPrice", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("minPrice=abc"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("Invalid minPrice");
  });
});

describe("applyProductQuery", () => {
  it("filters by category", () => {
    const result = applyProductQuery(PRODUCTS, { category: "BLUSH" });
    expect(result.map((p) => p.id)).toEqual(["3"]);
  });

  it("filters by brand case-insensitively", () => {
    const result = applyProductQuery(PRODUCTS, { brand: "dior" });
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("filters by price range", () => {
    const result = applyProductQuery(PRODUCTS, { minPrice: 35, maxPrice: 40 });
    expect(result.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("filters by q across name, brand, and shade", () => {
    expect(applyProductQuery(PRODUCTS, { q: "coral" }).map((p) => p.id)).toEqual(["2"]);
    expect(applyProductQuery(PRODUCTS, { q: "yves" }).map((p) => p.id)).toEqual(["1"]);
  });

  it("returns all products when the query is empty", () => {
    expect(applyProductQuery(PRODUCTS, {})).toHaveLength(3);
  });
});
