"use client";

import { useEffect, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";

type Props = {
  productId: string;
  /** Open this product's details in place of the current one. */
  onSelect: (product: CatalogProduct) => void;
};

export function SimilarCarousel({ productId, onSelect }: Props) {
  const [similar, setSimilar] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${productId}/similar`)
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then((data: CatalogProduct[]) => {
        if (!cancelled) {
          setSimilar(data);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) {
    return <p className="mt-6 text-xs text-textMuted">Couldn&apos;t load similar products.</p>;
  }

  if (similar.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
        Similar From Other Brands
      </p>
      <div className="mt-2 flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {similar.map((p) => (
          // A real button, not the bare swatch it used to be — these were inert,
          // so there was no way to reach a suggested product's details.
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            data-testid={`similar-${p.id}`}
            aria-label={`View ${p.brand} ${p.name}, ${p.shade}`}
            className="group shrink-0 rounded-card text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <div
              className="h-14 w-14 rounded-full transition-transform duration-150 ease-out group-hover:scale-105"
              style={{
                background: `linear-gradient(145deg, ${p.colorHex}cc, ${p.colorHex})`,
                boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
              }}
            />
            <p className="mt-1 w-16 truncate text-[10px] text-textSecondary transition-colors duration-150 group-hover:text-ink">
              {p.brand}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
