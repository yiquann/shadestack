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

  function clearSearch() {
    setQuery("");
    setAppliedQuery("");
  }

  function selectCategory(category: CatalogProduct["category"] | "ALL") {
    // Picking a category is a fresh browse intent — drop any active search so
    // the category's own products show instead of an empty search result.
    setActiveCategory(category);
    clearSearch();
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
          Add Products
        </h2>
        <form
          className="relative mt-2"
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
            className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
          />
          {(query || appliedQuery) && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-textMuted transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ✕
            </button>
          )}
        </form>
      </div>
      <div className="shrink-0">
        <CategoryChips active={activeCategory} onChange={selectCategory} />
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
