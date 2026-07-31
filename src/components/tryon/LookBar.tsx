"use client";

import type { LookId } from "@/lib/tryon/session";

type Props = {
  /** Render one control per look; false shows the single-look control. */
  showBoth: boolean;
  /** The look currently editable — the only one whose `＋` is live when `bothEnabled` is false. */
  activeLook: LookId;
  /** Split view keeps every `＋` live; single view disables the inactive look's. */
  bothEnabled: boolean;
  /** Single-look only: whether `activeLook` has anything to view yet. */
  hasProducts: boolean;
  onView: (look: LookId) => void;
  onAdd: (look: LookId) => void;
};

// A pill split into two tap targets: a wide label and a trailing `＋`.
const PILL = "flex items-stretch overflow-hidden rounded-pill bg-chip";
const LABEL =
  "flex-1 truncate px-4 py-2.5 text-left text-xs font-semibold text-ink transition-colors duration-150 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";
const PLUS =
  "flex w-10 shrink-0 items-center justify-center border-l border-ink/10 text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Phone-width replacement for the inline search bar AND the Active Layers
 * container, which is hidden below `md` because a tall photo/camera preview
 * pushes it off the bottom of the screen. Tapping a look's label opens its
 * applied products; tapping its `＋` opens the catalog to add to it.
 *
 * Once Look B exists both controls stay put even back in single view — leaving
 * split view should not make a control vanish and reflow the row. Viewing does
 * not require edit rights, so only the inactive look's `＋` goes inactive.
 */
export function LookBar({
  showBoth,
  activeLook,
  bothEnabled,
  hasProducts,
  onView,
  onAdd,
}: Props) {
  if (!showBoth) {
    // Nothing applied yet: there is nothing to view, so the whole control adds.
    if (!hasProducts) {
      return (
        <button
          type="button"
          onClick={() => onAdd(activeLook)}
          data-testid={`add-products-${activeLook.toLowerCase()}`}
          className="w-full rounded-pill bg-chip px-4 py-2.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          + Add Products
        </button>
      );
    }
    return (
      <div className={PILL}>
        <button
          type="button"
          onClick={() => onView(activeLook)}
          data-testid={`view-products-${activeLook.toLowerCase()}`}
          className={LABEL}
        >
          View Products
        </button>
        <button
          type="button"
          onClick={() => onAdd(activeLook)}
          aria-label="Add products"
          data-testid={`add-products-${activeLook.toLowerCase()}`}
          className={PLUS}
        >
          ＋
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {(["A", "B"] as const).map((lk) => {
        const addDisabled = !bothEnabled && lk !== activeLook;
        return (
          <div key={lk} className={`${PILL} flex-1`}>
            <button
              type="button"
              onClick={() => onView(lk)}
              data-testid={`view-products-${lk.toLowerCase()}`}
              className={LABEL}
            >
              Look {lk}
            </button>
            <button
              type="button"
              disabled={addDisabled}
              title={addDisabled ? `Swap to edit Look ${lk}` : undefined}
              onClick={() => onAdd(lk)}
              aria-label={
                addDisabled
                  ? `Add products to Look ${lk} — swap to edit this look first`
                  : `Add products to Look ${lk}`
              }
              data-testid={`add-products-${lk.toLowerCase()}`}
              className={PLUS}
            >
              ＋
            </button>
          </div>
        );
      })}
    </div>
  );
}
