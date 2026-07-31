"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DESIGN_TOKENS } from "@/lib/tokens";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { computeDrawerGeometry, resolveDrag } from "@/lib/tryon/drawerGeometry";
import { useVisualViewport } from "@/lib/tryon/useVisualViewport";
import { ProductList } from "@/components/catalog/ProductList";
import { searchProducts } from "@/components/catalog/filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";
import { LayerPanel } from "@/components/layers/LayerPanel";

type Props = {
  products: CatalogProduct[];
  /** Which look every add in this drawer targets. */
  look: LookId;
  /** `add` shows the searchable catalog; `view` shows the look's applied layers. */
  mode: "add" | "view";
  /** Show the "Adding to Look B" caption — only meaningful when both looks exist. */
  showTarget: boolean;
  /** Marks a look the user can view but not currently edit — e.g. the inactive look in single view when both looks are populated. */
  readOnly?: boolean;
  onClose: () => void;
};

/**
 * Phone-width sheet for adding products to one look. Opens showing the whole
 * catalog; the search field filters it and is deliberately not autofocused, so
 * the keyboard does not immediately cover the list the drawer just opened.
 */
export function ProductDrawer({
  products,
  look,
  mode,
  showTarget,
  readOnly = false,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  // Live gripper drag offset in px; 0 whenever the panel is at rest.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const metrics = useVisualViewport();
  const { bottomInset, height, hasScrim } = computeDrawerGeometry(metrics);
  const results = searchProducts(products, query);

  // Lock the page behind the sheet, and hand focus back to the trigger button
  // when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Blur first so the keyboard retracts with the drawer instead of lingering.
      inputRef.current?.blur();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The drawer is a phone-width affordance. If the viewport grows past `md`
  // — rotation, a foldable, a resized window — the desktop layout takes over
  // and the sheet must not be left floating above it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 48rem)");
    const onChange = () => {
      if (mq.matches) onClose();
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [onClose]);

  function dismiss() {
    inputRef.current?.blur();
    onClose();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { y: e.clientY, t: e.timeStamp };
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    // Upward drag is clamped — the drawer never grows past its cap.
    setDragY(Math.max(0, e.clientY - dragStart.current.y));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    setDragY(0);
    if (!start) return;
    const deltaY = e.clientY - start.y;
    const elapsed = Math.max(1, e.timeStamp - start.t);
    if (resolveDrag({ deltaY, height, velocity: deltaY / elapsed }) === "close") dismiss();
  }

  return (
    <>
      {hasScrim && (
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="fixed inset-0 bg-ink/30"
          style={{ zIndex: 60, animation: "fadeIn 0.2s ease-out" }}
        />
      )}

      {/* Outer element owns the entry animation and geometry; the inner one owns
          the drag transform, so a snap-back never replays slideUp. */}
      <div
        className="fixed inset-x-0"
        style={{ zIndex: 60, bottom: bottomInset, height, animation: "slideUp 0.25s ease-out" }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            mode === "add" ? `Add products to Look ${look}` : `Look ${look} products`
          }
          className="flex h-full flex-col overflow-hidden bg-surface"
          style={{
            borderRadius: DESIGN_TOKENS.radii.sheet,
            transform: `translateY(${dragY}px)`,
            transition: dragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          {/* touch-none stops the browser from scrolling instead of dragging. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden
            className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2.5"
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {mode === "add" ? (
            <div className="shrink-0 px-5 pb-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  aria-label="Search products to add"
                  // text-base (16px): under 16px iOS Safari auto-zooms on focus.
                  className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-base text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-textMuted transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    ✕
                  </button>
                )}
              </div>
              {showTarget && (
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
                  Adding to Look {look}
                </p>
              )}
            </div>
          ) : (
            <p className="shrink-0 px-5 pb-3 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
              {showTarget ? `Look ${look}` : "Active Layers"}
              {readOnly && (
                <span className="ml-1 font-normal normal-case tracking-normal text-textFaint">
                  · swap to edit
                </span>
              )}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "add" ? (
              <ProductList
                products={results}
                onSelect={setSelectedProduct}
                tryOnAsLink={false}
                look={look}
                singleAdd
                addLabel="Add"
              />
            ) : (
              <div
                className={`px-5 pb-4 ${readOnly ? "opacity-50" : ""}`}
                inert={readOnly || undefined}
              >
                <LayerPanel look={look} hideHeading />
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailSheet
          product={selectedProduct}
          look={look}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
