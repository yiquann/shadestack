"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "./CategoryChips";
import { HeroBanner } from "./HeroBanner";
import { ProductList } from "./ProductList";
import { SearchOverlay } from "./SearchOverlay";
import { filterByCategory } from "./filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function DiscoverView({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">(
    "ALL"
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const visibleProducts = filterByCategory(products, activeCategory);

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6">
        <h1 className="font-display text-2xl text-ink">Discover</h1>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      <HeroBanner />
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
        <ProductDetailSheet
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
