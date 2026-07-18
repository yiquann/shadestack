"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker, type SourceMode } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { PhotoSource } from "./PhotoSource";
import { CameraSource } from "./CameraSource";
import type { RenderLooks } from "./RenderCanvas";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { ProductSearchBar } from "./ProductSearchBar";
import { nextFacingMode, type FacingMode } from "@/lib/facemesh/cameraHelpers";
import { SplitControls } from "./SplitControls";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { looks, clearLook, mode: viewMode, setMode: setViewMode } = useTryOnSession();
  const [swapped, setSwapped] = useState(false);
  const [divider, setDivider] = useState(true);

  const left = swapped ? looks.B : looks.A;
  const right = swapped ? looks.A : looks.B;
  const renderLooks: RenderLooks =
    viewMode === "split"
      ? { mode: "split", left, right, divider }
      : { mode: "single", layers: looks.A };
  const hasLayers = viewMode === "split" ? looks.A.length > 0 || looks.B.length > 0 : looks.A.length > 0;
  const [mode, setMode] = useState<SourceMode>("model");
  const [facingMode, setFacingMode] = useState<FacingMode>("user");

  return (
    // Fixed to the viewport (minus the bottom nav) and non-scrolling; the two
    // panels below scroll internally instead of the whole page.
    <main className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden px-5 pt-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Try On</h1>
        <div className="w-full sm:w-auto sm:min-w-[260px]">
          <ModeSourcePicker active={mode} onChange={setMode} />
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left: face preview + controls */}
        <div className="flex min-h-0 flex-col items-center gap-3 md:w-[45%]">
          <div className="w-full shrink-0">
            {mode === "model" && <FaceMeshTracker looks={renderLooks} />}
            {mode === "photo" && <PhotoSource looks={renderLooks} />}
            {mode === "camera" && <CameraSource looks={renderLooks} facingMode={facingMode} />}
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
                    clearLook("A");
                  }
                }}
                data-testid="clear-look-button"
                className="rounded-pill border border-border px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear Look
              </button>
            )}
            {mode === "camera" && (
              <button
                type="button"
                onClick={() => setFacingMode(nextFacingMode)}
                className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
              >
                Flip camera
              </button>
            )}
          </div>

          <div className="w-full shrink-0">
            <SplitControls
              viewMode={viewMode}
              onModeChange={setViewMode}
              swapped={swapped}
              onSwap={() => setSwapped((s) => !s)}
              divider={divider}
              onToggleDivider={() => setDivider((d) => !d)}
            />
          </div>
        </div>

        {/* Right: search-to-add bar + the Active Layers stack (fills the rest) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="shrink-0">
            <ProductSearchBar products={products} />
          </div>
          {viewMode === "split" ? (
            <div className="flex min-h-0 flex-1 gap-3">
              {(["A", "B"] as const).map((lk) => (
                <div
                  key={lk}
                  className="flex min-h-0 flex-1 flex-col rounded-card border border-border p-3"
                >
                  <h3 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
                    Look {lk}
                  </h3>
                  <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                    <LayerPanel look={lk} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-card border border-border p-3">
              <LayerPanel look="A" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
