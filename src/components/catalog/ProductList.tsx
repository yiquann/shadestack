import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

type Props = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
};

export function ProductList({ products, onSelect }: Props) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-textMuted">No products found</p>
    );
  }

  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelect} />
      ))}
    </div>
  );
}
