"use client";

import { CATEGORIES, CATEGORY_LABELS, type CatalogProduct } from "@/lib/catalog/types";

type Props = {
  active: CatalogProduct["category"] | "ALL";
  onChange: (category: CatalogProduct["category"] | "ALL") => void;
};

// Tighter padding than the page's other pills on purpose: this is a long
// scrolling row, so trimming each chip fits more categories on screen at once.
// The 14px label stays — only the box around it comes in.
const CHIP_CLASS =
  "shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function CategoryChips({ active, onChange }: Props) {
  return (
    // -mx-5 cancels the page's own px-5 so the scroll track runs edge to edge,
    // then px-5 puts it back *inside* the scroller. The first chip therefore
    // lines up with the hero and search bar above it (previously the two
    // paddings stacked and indented it by a further 20px), while chips still
    // scroll all the way to the screen edge instead of stopping short of it.
    //
    // py-1 keeps the focus ring (ring-2 + ring-offset-2 = 4px) inside the
    // padding box, which is where overflow clips — `overflow-x-auto` forces
    // overflow-y to compute to auto, so a ring drawn outside would be cut off.
    // -my-1 then removes that padding from the layout box, so the row occupies
    // exactly the chips' height and the page's 6px section rhythm is unaffected.
    <div className="-mx-5 -my-1 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
