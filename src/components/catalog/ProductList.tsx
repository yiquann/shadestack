import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { ProductCard } from "./ProductCard";

type Props = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
  tryOnAsLink?: boolean;
  look?: LookId;
};

export function ProductList({ products, onSelect, tryOnAsLink = true, look }: Props) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-textMuted">No products found</p>
    );
  }

  return (
    <div>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelect}
          asLink={tryOnAsLink}
          look={look}
        />
      ))}
    </div>
  );
}
