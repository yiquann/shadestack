"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { ProductDrawer } from "./ProductDrawer";
import type { FacingMode } from "@/lib/facemesh/cameraHelpers";
import { TryOnDock } from "./TryOnDock";
import { dockActions, entryHighlight, lookSlots, primaryLook } from "@/lib/tryon/dockState";
import { SaveLookSheet } from "./SaveLookSheet";
import { useSaved } from "@/lib/saved/SavedContext";

type Props = {
  products: CatalogProduct[];
};

/** Mirrors the `chipHighlight` animation in globals.css — keep the two in step. */
const HIGHLIGHT_MS = 1200;

export function TryOnView({ products }: Props) {
  const { looks, mode: viewMode, setMode: setViewMode, source, setSource } =
    useTryOnSession();
  const { saveLook } = useSaved();
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  // Which look the phone-width drawer targets and what it is showing; null when closed.
  const [drawer, setDrawer] = useState<{ look: LookId; mode: "add" | "view" } | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const [swapped, setSwapped] = useState(false);
  // Split-view divider line (on by default). Separate from the single-view
  // before/after comparison, which is opt-in.
  const [divider, setDivider] = useState(true);
  const [compare, setCompare] = useState(false);
  // Which look chip is briefly ringed after entering split view; see
  // entryHighlight. Held in state rather than left to the CSS animation so the
  // class is actually removed afterwards and a second switch can replay it.
  const [highlight, setHighlight] = useState<LookId | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    []
  );

  const hasA = looks.A.length > 0;
  const hasB = looks.B.length > 0;
  // Swapping is a split-view action now, so `swapped` can only ever be true in
  // split; single view therefore falls through to the look that actually has
  // products (see primaryLook — Look B alone is a reachable state, and
  // rendering a bare face there would look like the app had lost them).
  const activeLook: LookId = viewMode === "split" && swapped ? "B" : primaryLook(looks);
  const actions = dockActions(viewMode, looks);
  const slots = lookSlots(viewMode, looks, swapped);
  // A chip the user can open but not add to — the dimmed Look B in single view.
  const isDimmed = (look: LookId) => slots.some((s) => s.look === look && !s.live);

  // One expression decides which look each half shows; the layers and the pill
  // label are both read off it, so they cannot drift apart on a swap.
  const leftLook: LookId = swapped ? "B" : "A";
  const rightLook: LookId = swapped ? "A" : "B";
  const renderLooks: RenderLooks =
    viewMode === "split"
      ? {
          mode: "split",
          left: looks[leftLook],
          right: looks[rightLook],
          divider,
          leftLook,
          rightLook,
        }
      : { mode: "single", layers: looks[activeLook], compare };
  const facingMode: FacingMode = "user";

  // Switching view always resets to the unswapped default: single lands on
  // Look A, split puts Look A on the left / Look B on the right. Nothing is
  // moved or reassigned in either direction, and there is no confirmation
  // prompt — the highlight below is the whole of the feedback.
  function handleViewModeChange(next: ViewMode) {
    setSwapped(false);
    setViewMode(next);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    const flagged = next === "split" ? entryHighlight(looks) : null;
    setHighlight(flagged);
    if (flagged) {
      highlightTimer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    }
  }

  return (
    // Fills whatever the app shell has left after the tab bar — no viewport
    // maths of its own, so the last control row cannot land under the bar.
    // Non-scrolling; the panels below scroll internally instead.
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-2 pt-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Try On</h1>
        <div className="w-full sm:w-auto sm:min-w-[260px]">
          <ModeSourcePicker active={source} onChange={setSource} />
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left: the stage over the dock. The preview is still the only flexible
            row, so nothing can ever be pushed out of the overflow-hidden frame
            and behind the tab bar — but on phones the dock below it is now a
            fixed height, so "whatever is left over" is a constant rather than
            something that shrinks each time a control appears. */}
        <div className="flex min-h-0 flex-1 flex-col items-center md:w-[34%] md:flex-none">
          {/* The stage. The only flexible row in the column: with the dock below
              it pinned to a constant height, the space left over here is
              constant too, so the preview keeps exactly one size for the whole
              session. */}
          <div className="flex min-h-0 w-full flex-1 justify-center">
            {source === "model" && <FaceMeshTracker looks={renderLooks} />}
            {source === "photo" && <PhotoSource looks={renderLooks} />}
            {source === "camera" && <CameraSource looks={renderLooks} facingMode={facingMode} />}
          </div>

          {/* The dock: everything below the preview, at a locked height on
              phones (see --dock-h).

              Deliberately undecorated — no rule, no background shift. The
              boundary is still structurally there and still reserves exactly the
              same space whether or not it is full; it is just not drawn. The
              preview above bottom-aligns onto that same edge, so the frame's
              lower edge is what marks the division and a second painted line
              would only sit under it.

              The negative bottom margin cancels main's own bottom padding on
              phones, so the dock's lower edge meets the tab bar exactly. Without
              it that padding would sit below row 2 and make the gap under the
              look slots larger than the one above row 1 — and it would cost the
              preview those pixels for nothing.

              md+ opts out — that layout has its own side panels and its controls
              have never been the thing squeezing the preview. */}
          <div className="-mb-2 flex h-[var(--dock-h)] w-full shrink-0 flex-col items-center justify-center gap-3 md:mb-0 md:h-auto md:pt-3">
            <TryOnDock
              viewMode={viewMode}
              onModeChange={handleViewModeChange}
              actions={actions}
              orientationOn={viewMode === "split" ? divider : compare}
              onOrientation={() =>
                viewMode === "split" ? setDivider((d) => !d) : setCompare((c) => !c)
              }
              onSwap={() => setSwapped((s) => !s)}
              onSave={() => setShowSaveSheet(true)}
              slots={slots}
              onViewLook={(look) => setDrawer({ look, mode: "view" })}
              onAddLook={(look) => setDrawer({ look, mode: "add" })}
              highlight={highlight}
            />
          </div>
        </div>

        {/* Right: the md+ panel column — search-to-add bar plus the Active
            Layers stack. Phones have no use for it now that the Look bar has
            moved into the dock, and an empty flex item there would still cost
            the parent's gap-4, taken straight off the preview. */}
        <div className="hidden min-h-0 shrink-0 flex-col gap-3 md:flex md:min-h-0 md:flex-1">
          <div className="shrink-0">
            <ProductSearchBar products={products} activeLook={activeLook} />
          </div>
          {viewMode === "split" || hasB ? (
            // Split shows both looks editable. Single-with-B shows both too, but
            // only the rendered look is editable; the other is disabled until
            // the user switches to split. (Swapping used to be the way back to
            // it — that is a split-only action now, so the hint below says
            // "switch to Split", not "swap".)
            <div className="hidden min-h-0 flex-1 gap-3 md:flex">
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
                          · switch to Split to edit
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
            <div className="hidden min-h-0 flex-1 flex-col rounded-card border border-border p-3 md:flex">
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

      {drawer && (
        <ProductDrawer
          // Keyed on the look alone, not on the mode: Browse flips view -> add
          // in place, and remounting there would replay the slideUp animation as
          // though a second sheet had opened.
          key={drawer.look}
          products={products}
          look={drawer.look}
          mode={drawer.mode}
          showTarget={viewMode === "split" || hasB}
          readOnly={drawer.mode === "view" && isDimmed(drawer.look)}
          onBrowse={(look) => setDrawer({ look, mode: "add" })}
          onClose={closeDrawer}
        />
      )}

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
