"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "@/components/catalog/CategoryChips";
import { ProductList } from "@/components/catalog/ProductList";
import { filterByCategory, searchProducts } from "@/components/catalog/filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function AddProductsSection({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  // Search filters the list in place — the query only takes effect on submit
  // (Enter), so typing never disrupts the current results or navigates away.
  const visibleProducts = searchProducts(
    filterByCategory(products, activeCategory),
    appliedQuery
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
          Add Products
        </h2>
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQuery(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full rounded-pill border border-border bg-surface px-4 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
          />
        </form>
      </div>
      <div className="shrink-0">
        <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProductList products={visibleProducts} onSelect={setSelectedProduct} />
      </div>
      {selectedProduct && (
        <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </section>
  );
}
