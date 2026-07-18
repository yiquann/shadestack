"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker, type SourceMode } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { PhotoSource } from "./PhotoSource";
import { CameraSource } from "./CameraSource";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { AddProductsSection } from "./AddProductsSection";
import { nextFacingMode, type FacingMode } from "@/lib/facemesh/cameraHelpers";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { layers, clearLook } = useTryOnSession();
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Left: Active Layers — its own full-height, scrollable column */}
        <div className="flex min-h-0 flex-col rounded-card border border-border p-3 lg:w-1/4">
          <h2 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
            Active Layers
          </h2>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            <LayerPanel />
          </div>
        </div>

        {/* Center: face preview + controls, kept centered like a mirror. On
            narrow screens it moves to the top. */}
        <div className="order-first flex min-h-0 flex-col items-center gap-3 lg:order-none lg:flex-1">
          <div className="w-full shrink-0">
            {mode === "model" && <FaceMeshTracker layers={layers} />}
            {mode === "photo" && <PhotoSource layers={layers} />}
            {mode === "camera" && <CameraSource layers={layers} facingMode={facingMode} />}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2">
            {layers.length > 0 && (
              <button
                type="button"
                onClick={clearLook}
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
        </div>

        {/* Right: product catalog to add from */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-card border border-border lg:w-1/4">
          <AddProductsSection products={products} />
        </div>
      </div>
    </main>
  );
}
