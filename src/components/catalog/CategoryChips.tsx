"use client";

import { CATEGORIES, CATEGORY_LABELS, type CatalogProduct } from "@/lib/catalog/types";

type Props = {
  active: CatalogProduct["category"] | "ALL";
  onChange: (category: CatalogProduct["category"] | "ALL") => void;
};

const CHIP_CLASS =
  "shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-xs font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function CategoryChips({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => onChange("ALL")}
        aria-pressed={active === "ALL"}
        className={`${CHIP_CLASS} ${
          active === "ALL"
            ? "bg-ink text-surface"
            : "bg-chip text-textSecondary hover:bg-chip-hover"
        }`}
      >
        All
      </button>
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onChange(category)}
          aria-pressed={active === category}
          className={`${CHIP_CLASS} ${
            active === category
              ? "bg-ink text-surface"
              : "bg-chip text-textSecondary hover:bg-chip-hover"
          }`}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
