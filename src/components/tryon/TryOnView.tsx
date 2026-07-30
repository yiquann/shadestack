"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId, ViewMode } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { PhotoSource } from "./PhotoSource";
import { CameraSource } from "./CameraSource";
import type { RenderLooks } from "./RenderCanvas";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { ProductSearchBar } from "./ProductSearchBar";
import type { FacingMode } from "@/lib/facemesh/cameraHelpers";
import { SplitControls } from "./SplitControls";
import { SaveLookSheet } from "./SaveLookSheet";
import { useSaved } from "@/lib/saved/SavedContext";

const ICON_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { looks, clearLook, mode: viewMode, setMode: setViewMode, source, setSource } =
    useTryOnSession();
  const { saveLook } = useSaved();
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [swapped, setSwapped] = useState(false);
  // Split-view divider line (on by default). Separate from the single-view
  // before/after comparison, which is opt-in.
  const [divider, setDivider] = useState(true);
  const [compare, setCompare] = useState(false);

  // Look B only exists once the user has added to it (via split). Until then,
  // single view is just one "Look" and there's nothing to swap between.
  const hasA = looks.A.length > 0;
  const hasB = looks.B.length > 0;
  // In single view the swap button flips the active (previewed/edited) look.
  const activeLook: LookId = swapped ? "B" : "A";

  const left = swapped ? looks.B : looks.A;
  const right = swapped ? looks.A : looks.B;
  const renderLooks: RenderLooks =
    viewMode === "split"
      ? { mode: "split", left, right, divider }
      : { mode: "single", layers: looks[activeLook], compare };
  const hasLayers =
    viewMode === "split"
      ? looks.A.length > 0 || looks.B.length > 0
      : looks[activeLook].length > 0;
  const facingMode: FacingMode = "user";

  // Switching view always resets to the unswapped default: single lands on
  // Look A, split puts Look A on the left / Look B on the right.
  function handleViewModeChange(next: ViewMode) {
    setSwapped(false);
    setViewMode(next);
  }

  return (
    // Fixed to the viewport (minus the bottom nav) and non-scrolling; the two
    // panels below scroll internally instead of the whole page.
    <main className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden px-5 pt-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Try On</h1>
        <div className="w-full sm:w-auto sm:min-w-[260px]">
          <ModeSourcePicker active={source} onChange={setSource} />
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left: face preview + controls */}
        <div className="flex min-h-0 flex-col items-center gap-3 md:w-[34%]">
          <div className="w-full shrink-0">
            {source === "model" && <FaceMeshTracker looks={renderLooks} />}
            {source === "photo" && <PhotoSource looks={renderLooks} />}
            {source === "camera" && <CameraSource looks={renderLooks} facingMode={facingMode} />}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2">
            {hasLayers && (
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "split") {
                    clearLook("A");
                    clearLook("B");
                  } else {
                    clearLook(activeLook);
                  }
                }}
                data-testid="clear-look-button"
                className="rounded-pill border border-border px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear Look
              </button>
            )}
            {hasLayers && (
              <button
                type="button"
                onClick={() => setShowSaveSheet(true)}
                className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Save Look
              </button>
            )}
            {(viewMode === "split" || (viewMode === "single" && hasB)) && (
              <button
                type="button"
                onClick={() => setSwapped((s) => !s)}
                aria-label={viewMode === "split" ? "Swap sides" : "Swap look"}
                title="Swap"
                className={`${ICON_BTN} bg-chip text-textSecondary hover:bg-chip-hover hover:text-ink`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M4 9h12M16 9l-3-3M16 9l-3 3M20 15H8M8 15l3-3M8 15l3 3" />
                </svg>
              </button>
            )}
            {(viewMode === "split" || (viewMode === "single" && hasLayers)) && (
              <button
                type="button"
                onClick={() =>
                  viewMode === "split"
                    ? setDivider((d) => !d)
                    : setCompare((c) => !c)
                }
                aria-pressed={viewMode === "split" ? divider : compare}
                aria-label={viewMode === "split" ? "Toggle divider" : "Toggle before and after"}
                title={viewMode === "split" ? "Divider" : "Before / after"}
                className={`${ICON_BTN} ${
                  (viewMode === "split" ? divider : compare)
                    ? "bg-ink text-surface"
                    : "bg-chip text-textSecondary hover:bg-chip-hover hover:text-ink"
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            )}
          </div>

          <div className="w-full shrink-0">
            <SplitControls
              viewMode={viewMode}
              onModeChange={handleViewModeChange}
              swapped={swapped}
              hasB={hasB}
            />
          </div>
        </div>

        {/* Right: search-to-add bar + the Active Layers stack (fills the rest) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="shrink-0">
            <ProductSearchBar products={products} activeLook={activeLook} />
          </div>
          {viewMode === "split" || hasB ? (
            // Split shows both looks editable. Single-with-B shows both too, but
            // only the active look is editable; the other is disabled until the
            // user swaps to it.
            <div className="flex min-h-0 flex-1 gap-3">
              {(["A", "B"] as const).map((lk) => {
                const isDisabled = viewMode === "single" && lk !== activeLook;
                return (
                  <div
                    key={lk}
                    inert={isDisabled || undefined}
                    aria-disabled={isDisabled}
                    className={`flex min-h-0 flex-1 flex-col rounded-card border border-border p-3 ${
                      isDisabled ? "opacity-50" : ""
                    }`}
                  >
                    <h3 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
                      Look {lk}
                      {isDisabled && (
                        <span className="ml-1 font-normal normal-case tracking-normal text-textFaint">
                          · swap to edit
                        </span>
                      )}
                    </h3>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                      <LayerPanel look={lk} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col rounded-card border border-border p-3">
              <h3 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
                Look
              </h3>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <LayerPanel look="A" />
              </div>
            </div>
          )}
        </div>
      </div>

      {showSaveSheet && (
        <SaveLookSheet
          hasA={hasA}
          hasB={hasB}
          defaultLook={activeLook}
          onClose={() => setShowSaveSheet(false)}
          onSave={(choices) => {
            choices.forEach((c) => saveLook(c.name, looks[c.look]));
            setShowSaveSheet(false);
          }}
        />
      )}
    </main>
  );
}
