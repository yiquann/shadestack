"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "./CategoryChips";
import { HeroBanner } from "./HeroBanner";
import { ProductList } from "./ProductList";
import { filterByCategory, searchProducts } from "./filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function DiscoverView({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">(
    "ALL"
  );
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const visibleProducts = searchProducts(
    filterByCategory(products, activeCategory),
    query
  );

  return (
    <>
      <h1 className="shrink-0 font-display text-2xl text-ink">Discover</h1>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left: all products in a scrollable container */}
        <div className="flex min-h-0 flex-col gap-3 md:w-1/2">
          <div className="shrink-0">
            <CategoryChips active={activeCategory} onChange={setActiveCategory} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-card border border-border">
            <ProductList products={visibleProducts} onSelect={setSelectedProduct} />
          </div>
        </div>

        {/* Right: virtual try-on banner + product search */}
        <div className="flex min-h-0 flex-col gap-4 md:w-1/2">
          <HeroBanner />
          <div className="relative shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-textMuted transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailSheet
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
