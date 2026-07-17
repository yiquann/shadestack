import type { CatalogProduct } from "./types";

export function selectSimilarProducts(
  products: CatalogProduct[],
  target: CatalogProduct,
  limit = 6
): CatalogProduct[] {
  return products
    .filter(
      (p) => p.id !== target.id && p.category === target.category && p.brand !== target.brand
    )
    .slice(0, limit);
}
