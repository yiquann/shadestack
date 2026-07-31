"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { DESIGN_TOKENS } from "@/lib/tokens";
import { SimilarCarousel } from "./SimilarCarousel";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { useSaved } from "@/lib/saved/SavedContext";
import type { LookId } from "@/lib/tryon/session";

type Props = {
  product: CatalogProduct;
  /** Which look "Try On" adds to. Defaults to Look A for catalog surfaces (Discover, Saved) that have no look context. */
  look?: LookId;
  onClose: () => void;
};

// Drag further than this down the screen and releasing dismisses the sheet;
// anything shorter springs back.
const DISMISS_AFTER_PX = 60;
// Movement under this counts as a tap rather than a drag, so the handle still
// works as a plain "close" button.
const TAP_SLOP_PX = 6;

/**
 * Keyed on the product the caller opened, so that opening a *different* product
 * from the list mounts a fresh sheet (resetting any similar-product navigation
 * done inside it), while navigating within the sheet does not remount it.
 */
export function ProductDetailSheet({ product, look = "A", onClose }: Props) {
  return <DetailSheet key={product.id} product={product} look={look} onClose={onClose} />;
}

function DetailSheet({ product, look = "A", onClose }: Props) {
  const { addProduct } = useTryOnSession();
  const { isProductSaved, toggleProductSaved } = useSaved();
  // The product currently on show. Starts as the one the caller opened and is
  // replaced in place when a "Similar From Other Brands" swatch is tapped, so
  // that navigation happens inside the sheet rather than closing it.
  const [viewing, setViewing] = useState(product);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saved = isProductSaved(viewing.id);

  function showProduct(next: CatalogProduct) {
    setViewing(next);
    // It is a different product now — start it from the top rather than
    // wherever the previous one happened to be scrolled to.
    scrollRef.current?.scrollTo({ top: 0 });
  }
  // Live finger offset while dragging the handle; drives the sheet's transform.
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  // Set when a drag travelled far enough to count, so the click that browsers
  // synthesise after the pointer sequence doesn't also fire onClose.
  const draggedRef = useRef(false);

  // Escape closes too — the sheet previously had no keyboard dismissal at all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragStartY.current = e.clientY;
    draggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current === null) return;
    // Clamp at 0: the sheet is anchored to the bottom, so it only drags down.
    const dy = Math.max(0, e.clientY - dragStartY.current);
    if (dy > TAP_SLOP_PX) draggedRef.current = true;
    setDragY(dy);
  }

  function onPointerUp() {
    if (dragStartY.current === null) return;
    const shouldClose = dragY >= DISMISS_AFTER_PX;
    dragStartY.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  }
  const sephoraUrl = `https://www.sephora.com/search?keyword=${encodeURIComponent(
    `${viewing.brand} ${viewing.name}`
  )}`;

  return (
    <div className="fixed inset-0" style={{ zIndex: 70 }}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />
      <div
        ref={scrollRef}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-surface p-6"
        style={{
          borderRadius: DESIGN_TOKENS.radii.sheet,
          // Only animate in when idle: keeping a transition on during the drag
          // would make the sheet lag behind the finger.
          animation: dragY ? undefined : "slideUp 0.25s ease-out",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 0.2s ease-out",
        }}
      >
        {/* The grab handle. Was a decorative <div> with no handler, so the sheet
            could only be dismissed by tapping the scrim behind it. Now it drags
            down to dismiss and doubles as a plain close button for tap and
            keyboard. Padding gives it a finger-sized target around the 4px bar. */}
        <button
          type="button"
          aria-label="Close"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            onClose();
          }}
          className="mx-auto -mt-2 mb-2 flex w-full touch-none justify-center py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </button>
        <div
          className="mx-auto h-24 w-24 rounded-full"
          style={{
            background: `linear-gradient(145deg, ${viewing.colorHex}cc, ${viewing.colorHex})`,
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
          }}
        />
        <h2 className="mt-4 text-center font-display text-xl text-ink">{viewing.name}</h2>
        <p className="mt-1 text-center text-sm text-textSecondary">
          {viewing.brand} · {viewing.shade}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-lg font-semibold text-accent">${viewing.price}</p>
          {/* Shade pigment beside the price. Decorative — the shade is already
              named in the line above, so it carries no extra information. */}
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded-full"
            style={{
              backgroundColor: viewing.colorHex,
              boxShadow:
                "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)",
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[viewing.coverage, viewing.finish, viewing.skinType].map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-chip px-3 py-1 text-xs font-semibold text-textSecondary"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-textSecondary">{viewing.desc}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/try-on"
            onClick={() => {
              addProduct(viewing, look);
              onClose();
            }}
            data-testid={`try-on-${viewing.id}`}
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Try On
          </Link>
          <button
            onClick={() => toggleProductSaved(viewing)}
            aria-label={saved ? "Remove from saved" : "Save"}
            aria-pressed={saved}
            className={`rounded-pill bg-chip px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              saved ? "text-accent" : "text-ink"
            }`}
          >
            {/* One SVG whose fill toggles, not two different glyphs. ♥ (U+2665)
                and ♡ (U+2661) come from different Unicode blocks and are drawn
                at noticeably different sizes, so the heart appeared to shrink
                the moment it was filled. Identical geometry in both states. */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <a
          href={sephoraUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-pill border border-border px-4 py-3 text-center text-sm font-semibold text-ink transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Buy on Sephora
        </a>
        <SimilarCarousel productId={viewing.id} onSelect={showProduct} />
      </div>
    </div>
  );
}
