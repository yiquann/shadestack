import type { CatalogProduct } from "@/lib/catalog/types";

export function filterByCategory(
  products: CatalogProduct[],
  category: CatalogProduct["category"] | "ALL"
): CatalogProduct[] {
  if (category === "ALL") return products;
  return products.filter((p) => p.category === category);
}

export function searchProducts(products: CatalogProduct[], query: string): CatalogProduct[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return products;
  return products.filter((p) =>
    `${p.name} ${p.brand} ${p.shade}`.toLowerCase().includes(trimmed)
  );
}
