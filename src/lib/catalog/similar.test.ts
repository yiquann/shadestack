import { describe, expect, it } from "vitest";
import { selectSimilarProducts } from "./similar";
import type { CatalogProduct } from "./types";

const make = (overrides: Partial<CatalogProduct>): CatalogProduct => ({
  id: "id",
  category: "LIPSTICK",
  name: "name",
  brand: "brand",
  shade: "shade",
  colorHex: "#000000",
  price: 10,
  coverage: "Full",
  finish: "Matte",
  skinType: "All skin types",
  desc: "d",
  ...overrides,
});

describe("selectSimilarProducts", () => {
  it("excludes the target product itself", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [target, make({ id: "2", brand: "B" })];
    const result = selectSimilarProducts(products, target);
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("excludes products from the same brand as the target", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [target, make({ id: "2", brand: "A" }), make({ id: "3", brand: "B" })];
    const result = selectSimilarProducts(products, target);
    expect(result.map((p) => p.id)).toEqual(["3"]);
  });

  it("excludes products from a different category", () => {
    const target = make({ id: "1", brand: "A", category: "LIPSTICK" });
    const products = [target, make({ id: "2", brand: "B", category: "BLUSH" })];
    const result = selectSimilarProducts(products, target);
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [
      target,
      make({ id: "2", brand: "B" }),
      make({ id: "3", brand: "C" }),
      make({ id: "4", brand: "D" }),
    ];
    const result = selectSimilarProducts(products, target, 2);
    expect(result).toHaveLength(2);
  });
});
