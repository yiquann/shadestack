import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { CategoryIcon } from "./CategoryIcon";

type Props = {
  product: CatalogProduct;
  onSelect: (product: CatalogProduct) => void;
  // Discover links to the Try On tab while adding; in-app (already on Try On)
  // it should just add without a same-page navigation.
  asLink?: boolean;
  look?: LookId;
  // The mobile drawer is opened already targeting one look, so it opts out of
  // the split-view + A / + B pair and shows a single button aimed at `look`.
  singleAdd?: boolean;
  /** Resting label. The added state overrides it, so this is the "not yet" copy. */
  addLabel?: string;
};

export function ProductCard({
  product,
  onSelect,
  asLink = true,
  look = "A",
  singleAdd = false,
  addLabel = "Add",
}: Props) {
  const { addProduct, looks, mode } = useTryOnSession();
  const splitAdd = !asLink && !singleAdd && mode === "split";

  // Derived, never stored: a button is "added" for exactly as long as this
  // product occupies its category in the target look. Because applyProduct
  // replaces by category, swapping one blush for another flips both rows in the
  // same render — the old one back to "Add", the new one to "Added" — with no
  // per-button state to keep in sync.
  const isAdded = (target: LookId) =>
    looks[target].some((layer) => layer.product.id === product.id);

  // px-4/py-2.5/text-sm rather than the design system's 11-12px pill: this is the
  // row's only real target, so it earns the extra weight. Sets the row height —
  // 20px price row + 8px gap + 40px button = 68px, over the 56px thumbnail, so
  // min-h below and ROW_HEIGHT in drawerGeometry.ts both read 100px.
  const baseClass =
    "shrink-0 rounded-pill px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
  const tryOnClass = `${baseClass} bg-chip text-ink hover:bg-chip-hover`;
  // Denser fill from the same warm family, so "added" reads as more opaque than
  // the neutral chip without shouting like a solid-accent CTA would in a list.
  // 40% is the floor that actually separates: accent at 20% over the cream bg
  // composites to ~#EFE2D7, within a few RGB points of chip's #F3E8E0 — invisible.
  // 40% lands near #E4CDBC, clearly warmer than both chip and chip-hover
  // (#E8DDD4), so a hovered "Add" can't be mistaken for an added one.
  // cursor-default overrides the global `button:disabled { cursor: not-allowed }`
  // (globals.css) — this pill is done, not blocked. The `[&:disabled]:` prefix
  // is what gets it the specificity to win over that element+pseudo selector.
  const addedClass = `${baseClass} bg-accent/40 text-ink [&:disabled]:cursor-default`;

  // A bare "✓ Added" says neither what was added nor where it went, and the
  // checkmark is decorative to a screen reader.
  const addedLabel = (target: LookId) =>
    `${product.name} added to Look ${target}`;

  return (
    // min-h 100px: the price/swatch + button stack on the right now measures 68px,
    // which with py-4 sets the floor. Keep in step with ROW_HEIGHT in
    // lib/tryon/drawerGeometry.ts — the drawer sizes itself to show four rows.
    <div className="flex min-h-[100px] items-center gap-3 border-b border-border px-5 py-4 transition-colors duration-150 hover:bg-chip/40">
      <button
        onClick={() => onSelect(product)}
        // min-w-0 lets this half actually shrink, which is what allows the
        // truncation below to engage instead of the row growing past its width.
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-chip">
          <CategoryIcon category={product.category} />
        </div>
        {/* Brand / name / shade, one per row. Each truncates independently so a
            long name can never push the price and Add button off the row —
            previously the three ran together on one nowrap line that scrolled. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{product.brand}</p>
          <p className="truncate text-sm text-textSecondary">{product.name}</p>
          <p className="truncate text-xs text-textMuted">{product.shade}</p>
        </div>
      </button>
      {/* Price + swatch above the action, stacked rather than strung out in one
          row: shrink-0 guarantees it never compresses, and stacking keeps the
          fixed side narrow so the product name gets the remaining width. */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-sm font-semibold text-accent">
            ${product.price}
          </span>
          <div
            className="h-5 w-5 shrink-0 rounded-full"
            style={{
              backgroundColor: product.colorHex,
              boxShadow:
                "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)",
            }}
          />
        </div>
        {asLink ? (
          <Link
            href="/try-on"
            onClick={() => addProduct(product, look)}
            data-testid={`try-on-${product.id}`}
            className={tryOnClass}
          >
            {addLabel}
          </Link>
        ) : splitAdd ? (
          // Each side checks its own look, so a product can read as added to A
          // while B still offers to take it.
          <div className="flex shrink-0 gap-1.5">
            {(["A", "B"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => addProduct(product, side)}
                disabled={isAdded(side)}
                aria-label={isAdded(side) ? addedLabel(side) : undefined}
                data-testid={`try-on-${side.toLowerCase()}-${product.id}`}
                className={isAdded(side) ? addedClass : tryOnClass}
              >
                {isAdded(side) ? `✓ ${side}` : `+ ${side}`}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => addProduct(product, look)}
            disabled={isAdded(look)}
            aria-label={isAdded(look) ? addedLabel(look) : undefined}
            data-testid={`try-on-${product.id}`}
            className={isAdded(look) ? addedClass : tryOnClass}
          >
            {isAdded(look) ? "✓ Added" : addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
