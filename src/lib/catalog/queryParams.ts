import { CATEGORIES, type CatalogProduct } from "./types";

export type ProductQuery = {
  category?: CatalogProduct["category"];
  brand?: string;
  q?: string;
  finish?: string;
  coverage?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type QueryValidationResult =
  | { valid: true; query: ProductQuery }
  | { valid: false; errors: string[] };

export function parseAndValidateProductQuery(
  searchParams: URLSearchParams
): QueryValidationResult {
  const errors: string[] = [];
  const query: ProductQuery = {};

  const category = searchParams.get("category");
  if (category !== null) {
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`Invalid category: ${category}`);
    } else {
      query.category = category as CatalogProduct["category"];
    }
  }

  const brand = searchParams.get("brand");
  if (brand !== null) query.brand = brand;

  const q = searchParams.get("q");
  if (q !== null) query.q = q;

  const finish = searchParams.get("finish");
  if (finish !== null) query.finish = finish;

  const coverage = searchParams.get("coverage");
  if (coverage !== null) query.coverage = coverage;

  const minPriceRaw = searchParams.get("minPrice");
  if (minPriceRaw !== null) {
    const minPrice = Number(minPriceRaw);
    if (Number.isNaN(minPrice)) {
      errors.push(`Invalid minPrice: ${minPriceRaw}`);
    } else {
      query.minPrice = minPrice;
    }
  }

  const maxPriceRaw = searchParams.get("maxPrice");
  if (maxPriceRaw !== null) {
    const maxPrice = Number(maxPriceRaw);
    if (Number.isNaN(maxPrice)) {
      errors.push(`Invalid maxPrice: ${maxPriceRaw}`);
    } else {
      query.maxPrice = maxPrice;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, query };
}

export function applyProductQuery(
  products: CatalogProduct[],
  query: ProductQuery
): CatalogProduct[] {
  return products.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.brand && p.brand.toLowerCase() !== query.brand.toLowerCase()) return false;
    if (query.finish && p.finish.toLowerCase() !== query.finish.toLowerCase()) return false;
    if (query.coverage && p.coverage.toLowerCase() !== query.coverage.toLowerCase()) return false;
    if (query.minPrice !== undefined && p.price < query.minPrice) return false;
    if (query.maxPrice !== undefined && p.price > query.maxPrice) return false;
    if (query.q) {
      const needle = query.q.toLowerCase();
      const haystack = `${p.name} ${p.brand} ${p.shade}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
