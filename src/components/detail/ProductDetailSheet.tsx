"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { DESIGN_TOKENS } from "@/lib/tokens";
import { SimilarCarousel } from "./SimilarCarousel";

type Props = {
  product: CatalogProduct;
  onClose: () => void;
};

export function ProductDetailSheet({ product, onClose }: Props) {
  const [saved, setSaved] = useState(false);
  const sephoraUrl = `https://www.sephora.com/search?keyword=${encodeURIComponent(
    `${product.brand} ${product.name}`
  )}`;

  return (
    <div className="fixed inset-0" style={{ zIndex: 70 }}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-surface p-6"
        style={{
          borderRadius: DESIGN_TOKENS.radii.sheet,
          animation: "slideUp 0.25s ease-out",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div
          className="mx-auto h-24 w-24 rounded-full"
          style={{
            background: `linear-gradient(145deg, ${product.colorHex}cc, ${product.colorHex})`,
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
          }}
        />
        <h2 className="mt-4 text-center font-display text-xl text-ink">{product.name}</h2>
        <p className="mt-1 text-center text-sm text-textSecondary">
          {product.brand} · {product.shade}
        </p>
        <p className="mt-1 text-center text-lg font-semibold text-accent">${product.price}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[product.coverage, product.finish, product.skinType].map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-chip px-3 py-1 text-xs font-semibold text-textSecondary"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-textSecondary">{product.desc}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/try-on"
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Try On
          </Link>
          <button
            onClick={() => setSaved((s) => !s)}
            aria-label={saved ? "Remove from saved" : "Save"}
            aria-pressed={saved}
            className={`rounded-pill bg-chip px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              saved ? "text-accent" : "text-ink"
            }`}
          >
            {saved ? "♥" : "♡"}
          </button>
        </div>
        <a
          href={sephoraUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-pill border border-border px-4 py-3 text-center text-sm font-semibold text-ink transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Buy on Sephora
        </a>
        <SimilarCarousel productId={product.id} />
      </div>
    </div>
  );
}
