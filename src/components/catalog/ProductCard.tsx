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
  addLabel?: string;
};

export function ProductCard({
  product,
  onSelect,
  asLink = true,
  look = "A",
  singleAdd = false,
  addLabel = "Try On",
}: Props) {
  const { addProduct, mode } = useTryOnSession();
  const splitAdd = !asLink && !singleAdd && mode === "split";
  const tryOnClass =
    "shrink-0 rounded-pill bg-chip px-3 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  return (
    // min-h 94px: 5px taller than the previous 89px, so three stacked text rows
    // sit comfortably against the 56px thumbnail.
    <div className="flex min-h-[94px] items-center gap-3 border-b border-border px-5 py-4 transition-colors duration-150 hover:bg-chip/40">
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
            long name can never push the price and Try On button off the row —
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
          <span className="whitespace-nowrap text-xs font-semibold text-accent">
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
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => addProduct(product, "A")}
              data-testid={`try-on-a-${product.id}`}
              className={tryOnClass}
            >
              + A
            </button>
            <button
              type="button"
              onClick={() => addProduct(product, "B")}
              data-testid={`try-on-b-${product.id}`}
              className={tryOnClass}
            >
              + B
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => addProduct(product, look)}
            data-testid={`try-on-${product.id}`}
            className={tryOnClass}
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
