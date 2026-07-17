"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { searchProducts } from "./filtering";
import { ProductList } from "./ProductList";

type Props = {
  products: CatalogProduct[];
  onClose: () => void;
  onSelect: (product: CatalogProduct) => void;
};

export function SearchOverlay({ products, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const results = searchProducts(products, query);

  return (
    <div
      className="fixed inset-0 bg-bg"
      style={{ zIndex: 60, animation: "fadeIn 0.2s ease-out" }}
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-textFaint"
        />
        <button
          onClick={onClose}
          className="rounded-pill px-3 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Cancel
        </button>
      </div>
      <div className="overflow-y-auto">
        <ProductList products={results} onSelect={onSelect} />
      </div>
    </div>
  );
}
