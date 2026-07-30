"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { ProductList } from "@/components/catalog/ProductList";
import { searchProducts } from "@/components/catalog/filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
  // In single view, added products go to the active look (A or B). Ignored in
  // split view, where each product card offers explicit +A / +B buttons.
  activeLook?: LookId;
};

export function ProductSearchBar({ products, activeLook }: Props) {
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  // The results drawer opens live as the user types, and closes on an outside
  // click (dismissed) or when the query is cleared — the typed text is kept so
  // refocusing reopens it.
  const open = query.trim().length > 0 && !dismissed;
  const results = searchProducts(products, query);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
        }}
        onFocus={() => setDismissed(false)}
        placeholder="Search products to add…"
        aria-label="Search products to add"
        className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setDismissed(false);
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-textMuted transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setDismissed(true)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-card border border-border bg-surface shadow-[0_4px_14px_rgba(28,18,16,0.12)]">
            <ProductList
              products={results}
              onSelect={setSelectedProduct}
              tryOnAsLink={false}
              look={activeLook}
            />
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
