"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "./CategoryChips";
import { HeroBanner } from "./HeroBanner";
import { ProductList } from "./ProductList";
import { filterByCategory, searchProducts } from "./filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";
import { PageTitle } from "@/components/nav/PageTitle";

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
      <PageTitle>Discover</PageTitle>

      {/* Order down the page: title → hero → search → chips → list, separated by
          16px (mt-4) down to the search field, then 12px either side of the chip
          row. A single column at every width now, since the
          hero and the search bar both moved out of what used to be the
          right-hand column. These are direct flex children of <main>, which sets
          no gap of its own, so each section owns its own top margin.
          CategoryChips cancels its internal vertical padding with a matching
          negative margin, so it does not add to these gaps. */}
      <div className="mt-4 shrink-0">
        <HeroBanner />
      </div>

      <div className="relative mt-4 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          // text-base (16px), not text-sm: iOS Safari auto-zooms the page when a
          // focused field's font-size is under 16px. Applies to every text input.
          className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-base text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
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

      {/* mt-3, and mt-3 again on the list below: the chip row is the one band
          that reads as a control strip rather than a section, so it sits tighter
          to the search field above and the results below than the 16px rhythm
          the rest of the page keeps. */}
      <div className="mt-3 shrink-0">
        <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      </div>

      {/* No card and no scroller of its own — the page itself scrolls (see
          <main>). -mx-5 lets each row's divider span the full width while the
          rows' own px-5 keeps their content aligned with everything above. */}
      <div className="-mx-5 mt-3">
        <ProductList products={visibleProducts} onSelect={setSelectedProduct} />
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
