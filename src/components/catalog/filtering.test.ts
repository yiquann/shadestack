import { describe, expect, it } from "vitest";
import { filterByCategory, searchProducts } from "./filtering";
import type { CatalogProduct } from "@/lib/catalog/types";

const PRODUCTS: CatalogProduct[] = [
  { id: "1", category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "a" },
  { id: "2", category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "b" },
];

describe("filterByCategory", () => {
  it("returns all products for ALL", () => {
    expect(filterByCategory(PRODUCTS, "ALL")).toHaveLength(2);
  });

  it("filters to a single category", () => {
    expect(filterByCategory(PRODUCTS, "BLUSH").map((p) => p.id)).toEqual(["2"]);
  });
});

describe("searchProducts", () => {
  it("returns all products for an empty query", () => {
    expect(searchProducts(PRODUCTS, "")).toHaveLength(2);
    expect(searchProducts(PRODUCTS, "   ")).toHaveLength(2);
  });

  it("matches case-insensitively across name, brand, and shade", () => {
    expect(searchProducts(PRODUCTS, "orgasm").map((p) => p.id)).toEqual(["2"]);
    expect(searchProducts(PRODUCTS, "NARS").map((p) => p.id)).toEqual(["2"]);
    expect(searchProducts(PRODUCTS, "le rouge").map((p) => p.id)).toEqual(["1"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchProducts(PRODUCTS, "nonexistent")).toEqual([]);
  });
});
