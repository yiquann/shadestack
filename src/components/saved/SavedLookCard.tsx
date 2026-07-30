"use client";

import type { SavedLook } from "@/lib/saved/savedCollection";

type Props = {
  look: SavedLook;
  onApply: () => void;
  onDelete: () => void;
};

export function SavedLookCard({ look, onApply, onDelete }: Props) {
  const swatches = look.layers.slice(0, 5);
  const count = look.layers.length;
  const date = new Date(look.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="relative w-44 shrink-0 rounded-card border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(28,18,16,0.07)]">
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${look.name}`}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-textMuted transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={onApply}
        aria-label={`Apply ${look.name}`}
        className="block w-full text-left focus-visible:outline-none"
      >
        <div className="flex h-9 items-center">
          {swatches.length === 0 ? (
            <span className="text-xs text-textFaint">Empty look</span>
          ) : (
            swatches.map((l, i) => (
              <span
                key={l.category}
                className="h-9 w-9 rounded-full border-2 border-surface"
                style={{
                  marginLeft: i === 0 ? 0 : -12,
                  backgroundColor: l.product.colorHex,
                  boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
                }}
              />
            ))
          )}
        </div>
        <p className="mt-3 truncate text-sm font-semibold text-ink">{look.name}</p>
        <p className="mt-0.5 text-xs text-textMuted">
          {count} {count === 1 ? "product" : "products"} · {date}
        </p>
      </button>
    </div>
  );
}
