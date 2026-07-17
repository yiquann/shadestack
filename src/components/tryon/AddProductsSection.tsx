"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "@/components/catalog/CategoryChips";
import { ProductList } from "@/components/catalog/ProductList";
import { SearchOverlay } from "@/components/catalog/SearchOverlay";
import { SearchIconButton } from "@/components/catalog/SearchIconButton";
import { filterByCategory } from "@/components/catalog/filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function AddProductsSection({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const visibleProducts = filterByCategory(products, activeCategory);

  return (
    <section className="pb-4">
      <div className="flex items-center justify-between px-5 pt-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
          Add Products
        </h2>
        <SearchIconButton onClick={() => setSearchOpen(true)} />
      </div>
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      <ProductList products={visibleProducts} onSelect={setSelectedProduct} />
      {searchOpen && (
        <SearchOverlay
          products={products}
          onClose={() => setSearchOpen(false)}
          onSelect={(product) => {
            setSearchOpen(false);
            setSelectedProduct(product);
          }}
        />
      )}
      {selectedProduct && (
        <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </section>
  );
}
