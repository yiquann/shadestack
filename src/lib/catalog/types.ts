export const CATEGORIES = [
  "FOUNDATION",
  "BLUSH",
  "BRONZER",
  "HIGHLIGHTER",
  "EYESHADOW",
  "LIPSTICK",
  "SETTING_POWDER",
] as const;

export type CatalogProduct = {
  id: string;
  category: (typeof CATEGORIES)[number];
  name: string;
  brand: string;
  shade: string;
  colorHex: string;
  price: number;
  coverage: string;
  finish: string;
  skinType: string;
  desc: string;
};

type PrismaProductLike = {
  id: string;
  category: string;
  name: string;
  brand: string;
  shade: string;
  colorHex: string;
  price: unknown;
  coverage: string;
  finish: string;
  skinType: string;
  desc: string;
};

export function toCatalogProduct(product: PrismaProductLike): CatalogProduct {
  return {
    id: product.id,
    category: product.category as CatalogProduct["category"],
    name: product.name,
    brand: product.brand,
    shade: product.shade,
    colorHex: product.colorHex,
    price: Number(product.price),
    coverage: product.coverage,
    finish: product.finish,
    skinType: product.skinType,
    desc: product.desc,
  };
}
