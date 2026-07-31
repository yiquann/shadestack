# Mobile Product Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below 768px, replace the Try On tab's inline product search bar with look-targeted buttons that open a half-screen, keyboard-aware bottom drawer for adding products.

**Architecture:** The breakpoint swap is pure CSS — both the new trigger row (`md:hidden`) and the existing `ProductSearchBar` (`hidden md:block`) are rendered, so there is no media-query hook and no hydration mismatch. All drawer sizing math lives in two pure functions in `src/lib/tryon/drawerGeometry.ts`, driven by a thin `visualViewport` subscription hook, which keeps the only unit-testable logic out of the React component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Vitest (`environment: "node"`).

**Spec:** `docs/superpowers/specs/2026-07-30-mobile-product-drawer-design.md`

## Global Constraints

- Breakpoint is 768px — Tailwind's `md`. Do not introduce a new custom breakpoint.
- z-index ladder: bottom nav 50, product drawer 60, `ProductDetailSheet` / `SaveLookSheet` 70.
- Colors, radii, and shadows come from design tokens (`bg-surface`, `text-textMuted`, `DESIGN_TOKENS.radii.sheet`, …). Never hardcode a hex value in a component.
- TypeScript strict mode. No `any`.
- Vitest runs with `environment: "node"` — there is **no DOM or jsdom harness**. Do not write component tests or add a test environment. Only pure functions get unit tests; component tasks are gated on `npm run typecheck && npm run lint && npm test`.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`).
- The ≥768px layout keeps its inline search bar and its on-page Active Layers container. `src/components/tryon/ProductSearchBar.tsx` is not edited by any task. Two deliberate exceptions, both approved: Task 5's `LayerRow` fix applies at every width, and Task 8's stale-`swapped` fix corrects the target the desktop search bar reads. Nothing else at ≥768px may change.
- Drawer height cap is `0.5 * innerHeight`. Drag-close thresholds are 25% of panel height and 0.5 px/ms.
- Below 768px the Active Layers container is hidden and its content is reached through the drawer's view mode — a tall photo/camera preview otherwise pushes it off the bottom of a phone screen.

---

### Task 1: Drawer geometry helpers

Two pure functions: one turns viewport measurements into the drawer's position and size, the other decides what a released drag should do. These are the only unit-testable pieces of the feature, so they carry the full test cycle.

**Files:**
- Create: `src/lib/tryon/drawerGeometry.ts`
- Test: `src/lib/tryon/drawerGeometry.test.ts`

**Interfaces:**
- Consumes: nothing — this is the base task.
- Produces:
  - `type ViewportMetrics = { innerHeight: number; viewportHeight: number; viewportOffsetTop: number }`
  - `type DrawerGeometry = { bottomInset: number; height: number; hasScrim: boolean }`
  - `type DragRelease = { deltaY: number; height: number; velocity: number }`
  - `computeDrawerGeometry(metrics: ViewportMetrics): DrawerGeometry`
  - `resolveDrag(release: DragRelease): "close" | "snap-back"`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tryon/drawerGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeDrawerGeometry, resolveDrag } from "./drawerGeometry";

describe("computeDrawerGeometry", () => {
  it("caps the panel at half the screen when no keyboard is open", () => {
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 800, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 0, height: 400, hasScrim: true });
  });

  it("lifts the panel by the keyboard height, keeping the half-screen cap", () => {
    // A 300px keyboard leaves 500px visible — still roomier than the 400px cap.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 300, height: 400, hasScrim: true });
  });

  it("clamps to the visible viewport and drops the scrim under a tall keyboard", () => {
    // A 500px keyboard leaves 300px visible — less than the 400px cap, so the
    // panel fills the visible area and no space is left above it to tap.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 300, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 500, height: 300, hasScrim: false });
  });

  it("subtracts the visual viewport offset when pinch-zoom has scrolled it", () => {
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 120 })
        .bottomInset
    ).toBe(180);
  });

  it("never returns a negative inset", () => {
    // Some browsers briefly over-report visualViewport.height mid keyboard animation.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 900, viewportOffsetTop: 0 })
        .bottomInset
    ).toBe(0);
  });

  it("falls back to a plain half-screen drawer when visualViewport is unavailable", () => {
    // The hook passes innerHeight for both measurements in that case.
    expect(
      computeDrawerGeometry({ innerHeight: 640, viewportHeight: 640, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 0, height: 320, hasScrim: true });
  });
});

describe("resolveDrag", () => {
  it("closes when dragged past a quarter of the panel height", () => {
    expect(resolveDrag({ deltaY: 101, height: 400, velocity: 0 })).toBe("close");
  });

  it("snaps back just short of the distance threshold", () => {
    expect(resolveDrag({ deltaY: 99, height: 400, velocity: 0 })).toBe("snap-back");
  });

  it("closes on a fast flick that never reached the distance threshold", () => {
    expect(resolveDrag({ deltaY: 30, height: 400, velocity: 1.2 })).toBe("close");
  });

  it("snaps back on a slow, short drag", () => {
    expect(resolveDrag({ deltaY: 30, height: 400, velocity: 0.1 })).toBe("snap-back");
  });

  it("snaps back when dragged upward, however fast", () => {
    expect(resolveDrag({ deltaY: -80, height: 400, velocity: 2 })).toBe("snap-back");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/tryon/drawerGeometry.test.ts`
Expected: FAIL — `Failed to resolve import "./drawerGeometry"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/tryon/drawerGeometry.ts`:

```ts
/** Viewport measurements the drawer needs, read once per visualViewport event. */
export type ViewportMetrics = {
  /** Layout viewport height — `window.innerHeight`. Unaffected by the keyboard. */
  innerHeight: number;
  /** Visible viewport height — `visualViewport.height`, or `innerHeight` as a fallback. */
  viewportHeight: number;
  /** Visible viewport top offset — `visualViewport.offsetTop`, or 0 as a fallback. */
  viewportOffsetTop: number;
};

export type DrawerGeometry = {
  /** px between the layout viewport bottom and the drawer's bottom edge — the keyboard. */
  bottomInset: number;
  /** px height of the drawer panel. */
  height: number;
  /** Whether visible space remains above the panel for a tappable scrim. */
  hasScrim: boolean;
};

/** The drawer is capped at half the screen. */
const HEIGHT_FRACTION = 0.5;

/**
 * Positions the drawer above the on-screen keyboard. The height is clamped to
 * the visible viewport so a tall keyboard lifts the panel without ever pushing
 * its top edge off-screen; when that clamp bites there is no scrim left.
 */
export function computeDrawerGeometry({
  innerHeight,
  viewportHeight,
  viewportOffsetTop,
}: ViewportMetrics): DrawerGeometry {
  const bottomInset = Math.max(0, innerHeight - viewportHeight - viewportOffsetTop);
  const height = Math.min(HEIGHT_FRACTION * innerHeight, viewportHeight);
  return { bottomInset, height, hasScrim: height < viewportHeight };
}

/** A gripper drag at the moment the pointer is released. */
export type DragRelease = {
  /** Downward drag distance in px. Negative means the user dragged up. */
  deltaY: number;
  /** Panel height in px, from `computeDrawerGeometry`. */
  height: number;
  /** Downward speed at release, in px/ms. */
  velocity: number;
};

/** Close once dragged past this fraction of the panel height… */
const CLOSE_DISTANCE_FRACTION = 0.25;
/** …or when flicked down at least this fast, whatever the distance. */
const CLOSE_VELOCITY = 0.5;

export function resolveDrag({ deltaY, height, velocity }: DragRelease): "close" | "snap-back" {
  // Upward drag is never a dismissal — the drawer cannot grow past its cap.
  if (deltaY <= 0) return "snap-back";
  if (deltaY > height * CLOSE_DISTANCE_FRACTION) return "close";
  if (velocity > CLOSE_VELOCITY) return "close";
  return "snap-back";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/tryon/drawerGeometry.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Verify the whole suite and types are clean**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tryon/drawerGeometry.ts src/lib/tryon/drawerGeometry.test.ts
git commit -m "feat(tryon): add drawer geometry and drag-release helpers"
```

---

### Task 2: Single-target add button on product rows

`ProductCard` currently renders a `+ A` / `+ B` pair whenever it is in-app and the session is in split mode. The drawer already knows which look it targets, so it needs to opt out of that pair and show one button. Two additive optional props, both defaulting to today's behavior, so Discover, the similar carousel, and the desktop search bar are untouched.

**Files:**
- Modify: `src/components/catalog/ProductCard.tsx:7-20` (props and `splitAdd`), `:50-87` (button labels)
- Modify: `src/components/catalog/ProductList.tsx:5-31`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ProductList` and `ProductCard` both accept `singleAdd?: boolean` (default `false`) and `addLabel?: string` (default `"Try On"`). Task 3 passes `singleAdd addLabel="Add"`.

- [ ] **Step 1: Add the props to `ProductCard`**

In `src/components/catalog/ProductCard.tsx`, replace the `Props` type and the function signature/`splitAdd` line:

```tsx
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
```

- [ ] **Step 2: Use `addLabel` on the two non-split buttons**

Still in `ProductCard.tsx`, replace the literal `Try On` text in the `asLink` branch and in the final `else` branch with `{addLabel}`. The `+ A` / `+ B` branch is unchanged, and the `data-testid` values stay exactly as they are so existing selectors keep working:

```tsx
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
```

```tsx
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
```

- [ ] **Step 3: Thread both props through `ProductList`**

Replace the whole of `src/components/catalog/ProductList.tsx`:

```tsx
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { ProductCard } from "./ProductCard";

type Props = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
  tryOnAsLink?: boolean;
  look?: LookId;
  singleAdd?: boolean;
  addLabel?: string;
};

export function ProductList({
  products,
  onSelect,
  tryOnAsLink = true,
  look,
  singleAdd,
  addLabel,
}: Props) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-textMuted">No products found</p>
    );
  }

  return (
    <div>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelect}
          asLink={tryOnAsLink}
          look={look}
          singleAdd={singleAdd}
          addLabel={addLabel}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass. No existing caller passes the new props, so every current call site keeps its `+ A` / `+ B` and `Try On` behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/ProductCard.tsx src/components/catalog/ProductList.tsx
git commit -m "feat(catalog): let product rows render a single look-targeted add button"
```

---

### Task 3: The drawer

The bottom sheet itself, plus the `visualViewport` subscription that feeds it. The hook has no unit test — it is a DOM subscription and this repo has no DOM harness — so it is folded in here with the component that consumes it.

**Files:**
- Create: `src/lib/tryon/useVisualViewport.ts`
- Create: `src/components/tryon/ProductDrawer.tsx`

**Interfaces:**
- Consumes: `computeDrawerGeometry`, `resolveDrag`, `ViewportMetrics` from Task 1. `ProductList`'s `singleAdd` / `addLabel` props from Task 2.
- Produces: `<ProductDrawer products={CatalogProduct[]} look={LookId} showTarget={boolean} onClose={() => void} />`, which Task 4 mounts.

- [ ] **Step 1: Write the viewport hook**

Create `src/lib/tryon/useVisualViewport.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import type { ViewportMetrics } from "./drawerGeometry";

function readMetrics(): ViewportMetrics {
  const vv = window.visualViewport;
  return {
    innerHeight: window.innerHeight,
    viewportHeight: vv?.height ?? window.innerHeight,
    viewportOffsetTop: vv?.offsetTop ?? 0,
  };
}

/**
 * Tracks the visible viewport so a bottom sheet can sit above the on-screen
 * keyboard. Falls back to the layout viewport where `visualViewport` is
 * missing, which yields a plain bottom-anchored sheet.
 */
export function useVisualViewport(): ViewportMetrics {
  // Read lazily rather than in an effect so the drawer never paints a
  // zero-height frame. Safe because the drawer only ever mounts client-side,
  // in response to a tap.
  const [metrics, setMetrics] = useState<ViewportMetrics>(() =>
    typeof window === "undefined"
      ? { innerHeight: 0, viewportHeight: 0, viewportOffsetTop: 0 }
      : readMetrics()
  );

  useEffect(() => {
    const update = () => setMetrics(readMetrics());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return metrics;
}
```

- [ ] **Step 2: Write the drawer component**

Create `src/components/tryon/ProductDrawer.tsx`:

```tsx
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

type Props = {
  products: CatalogProduct[];
  /** Which look every add in this drawer targets. */
  look: LookId;
  /** Show the "Adding to Look B" caption — only meaningful when both looks exist. */
  showTarget: boolean;
  onClose: () => void;
};

/**
 * Phone-width sheet for adding products to one look. Opens showing the whole
 * catalog; the search field filters it and is deliberately not autofocused, so
 * the keyboard does not immediately cover the list the drawer just opened.
 */
export function ProductDrawer({ products, look, showTarget, onClose }: Props) {
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
          aria-label={`Add products to Look ${look}`}
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

          <div className="shrink-0 px-5 pb-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products to add"
                className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
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

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProductList
              products={results}
              onSelect={setSelectedProduct}
              tryOnAsLink={false}
              look={look}
              singleAdd
              addLabel="Add"
            />
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass. The component is not yet mounted anywhere, so nothing renders differently.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tryon/useVisualViewport.ts src/components/tryon/ProductDrawer.tsx
git commit -m "feat(tryon): add keyboard-aware product drawer for phone widths"
```

---

### Task 4 (v1): SUPERSEDED — do not implement

The original Task 4 built an `AddProductBar` whose buttons only *added* products, keeping the Active Layers container on the page below the trigger row. Mid-execution the user found that in photo and camera mode the tall face preview pushes that container below the fold on a phone, making it unreachable.

Its code (`src/components/tryon/AddProductBar.tsx` and the four `TryOnView` edits) is on disk and uncommitted. **Tasks 5-8 below revise it in place — they do not start from a clean tree.** Read the current state of both files before editing.

Two Important findings from Task 4 (v1)'s review are still open and are folded into Tasks 7 and 8:
- **Stale `swapped`** — clearing the look `swapped` points at leaves `activeLook` on an empty look; the row collapses to the single-look layout but still targets Look B, and the swap control disappears so it cannot be undone. Pre-existing in `TryOnView`. Fixed in Task 8.
- **No breakpoint guard** — opening the drawer below 768px then widening leaves the sheet fixed over the desktop layout. Fixed in Task 7.

Superseded reference (the original Task 4 text):

**Files:**
- Create: `src/components/tryon/AddProductBar.tsx`
- Modify: `src/components/tryon/TryOnView.tsx` — imports (`:1-17`), state (`:30-34`), the search-bar wrapper (`:180-182`), and the overlay block (`:227-238`)

**Interfaces:**
- Consumes: `<ProductDrawer>` from Task 3.
- Produces: `<AddProductBar showBoth={boolean} activeLook={LookId} bothEnabled={boolean} onOpen={(look: LookId) => void} />`. Terminal task — nothing consumes it.

- [ ] **Step 1: Write the trigger row**

Create `src/components/tryon/AddProductBar.tsx`:

```tsx
"use client";

import type { LookId } from "@/lib/tryon/session";

type Props = {
  /** Render both look buttons; false shows one untargeted button (only Look A exists). */
  showBoth: boolean;
  /** The look currently editable — the only enabled button when `bothEnabled` is false. */
  activeLook: LookId;
  /** Split view keeps both buttons live; single view disables the inactive one. */
  bothEnabled: boolean;
  onOpen: (look: LookId) => void;
};

const BTN =
  "rounded-pill bg-chip px-4 py-2.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-chip";

/**
 * Phone-width replacement for the inline search bar. Once Look B exists both
 * buttons stay put even back in single view — leaving split view should not
 * make a button vanish and reflow the row — with the look you cannot currently
 * edit simply going inactive, matching the layer panels below.
 */
export function AddProductBar({ showBoth, activeLook, bothEnabled, onOpen }: Props) {
  if (!showBoth) {
    return (
      <button
        type="button"
        onClick={() => onOpen(activeLook)}
        data-testid="add-products-button"
        className={`${BTN} w-full`}
      >
        + Add Products
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      {(["A", "B"] as const).map((lk) => {
        const isDisabled = !bothEnabled && lk !== activeLook;
        return (
          <button
            key={lk}
            type="button"
            disabled={isDisabled}
            title={isDisabled ? `Swap to edit Look ${lk}` : undefined}
            onClick={() => onOpen(lk)}
            data-testid={`add-products-${lk.toLowerCase()}`}
            className={`${BTN} flex-1`}
          >
            + Look {lk}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Import the new components in `TryOnView`**

In `src/components/tryon/TryOnView.tsx`, add below the existing `ProductSearchBar` import (line 13):

```tsx
import { ProductSearchBar } from "./ProductSearchBar";
import { AddProductBar } from "./AddProductBar";
import { ProductDrawer } from "./ProductDrawer";
```

- [ ] **Step 3: Add the drawer state**

In the same file, below `const [showSaveSheet, setShowSaveSheet] = useState(false);` (line 30):

```tsx
  // Which look the phone-width product drawer is adding to; null when closed.
  const [drawerLook, setDrawerLook] = useState<LookId | null>(null);
```

- [ ] **Step 4: Swap the search-bar row**

Replace the wrapper at lines 180-182:

```tsx
          <div className="shrink-0">
            <ProductSearchBar products={products} activeLook={activeLook} />
          </div>
```

with the breakpoint pair — both rendered, CSS picks one, so there is no media query and no hydration mismatch:

```tsx
          <div className="shrink-0 md:hidden">
            <AddProductBar
              showBoth={viewMode === "split" || hasB}
              activeLook={activeLook}
              bothEnabled={viewMode === "split"}
              onOpen={setDrawerLook}
            />
          </div>
          <div className="hidden shrink-0 md:block">
            <ProductSearchBar products={products} activeLook={activeLook} />
          </div>
```

- [ ] **Step 5: Mount the drawer**

In the same file, directly above the `{showSaveSheet && (` block (line 227):

```tsx
      {drawerLook && (
        <ProductDrawer
          products={products}
          look={drawerLook}
          showTarget={viewMode === "split" || hasB}
          onClose={() => setDrawerLook(null)}
        />
      )}
```

- [ ] **Step 6: Verify types, lint, and the suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, then open `http://localhost:3000/try-on`. If the port does not respond, stop any stale dev server and restart it before assuming a code fault. Check, with devtools at a 393px-wide mobile viewport:

1. At ≥768px the inline search bar is still there and behaves exactly as before.
2. Below 768px it is replaced by `+ Add Products`; tapping opens the drawer at half the screen height, showing the full catalog.
3. Typing filters the list; the `✕` clears the query and restores the full list without closing the drawer.
4. Tapping a row's `Add` applies the product to the layer panel behind, and the drawer stays open.
5. Tapping a row's name opens the detail sheet above the drawer.
6. Tapping the scrim closes it; dragging the gripper down past a quarter of its height closes it; a short drag springs back; `Escape` closes it.
7. Switch to Split View — the row becomes `+ Look A` / `+ Look B`, both live, each drawer captioned with its target and adding to the right look.
8. Switch back to single view with both looks populated — both buttons remain, only the active one is clickable, and the swap control moves which one is disabled.

Keyboard lift (step 3 of the spec's manual list) can only be confirmed on a physical phone; note it as untested if no device is available.

- [ ] **Step 8: Commit**

```bash
git add src/components/tryon/AddProductBar.tsx src/components/tryon/TryOnView.tsx
git commit -m "feat(tryon): swap the search bar for look-targeted drawer buttons on phones"
```

---

## Revision — 2026-07-30

Tasks 5-8 replace Task 4 (v1). They revise files that already exist on disk uncommitted; read each file's current state before editing. See the superseded-task note above for the two open review findings folded in here.

### Task 5: Layer row fits a narrow container

`LayerRow` was laid out for the desktop panel's column. In the drawer the product name pushes the visibility toggle and remove button off the right edge and clips the shade line. Constrain the text column so it truncates, and stack the two controls into one narrow column. Applies at every width — the row is better for it on desktop too.

**Files:**
- Modify: `src/components/layers/LayerRow.tsx:40-63` (text column), `:64-112` (the two control buttons)

**Interfaces:**
- Consumes: nothing.
- Produces: no API change. Same props, same handlers, same `data-testid`s, same `aria-label`s.

- [ ] **Step 1: Make the text column unable to overflow**

In `src/components/layers/LayerRow.tsx`, the text container currently reads `className="min-w-0 flex-1"`. Add `overflow-hidden` so the column clips regardless of the range input's intrinsic width:

```tsx
      <div className="min-w-0 flex-1 overflow-hidden">
```

Leave the two `<p>` elements and the `<input type="range">` inside it exactly as they are — they already carry `truncate` and `w-full`.

- [ ] **Step 2: Stack the visibility toggle above the remove button**

Wrap the two existing trailing `<button>` elements — the visibility toggle and the remove `✕` — in a single flex column. Do not change either button's handler, `aria-label`, `aria-pressed`, `data-testid`, or inner SVG markup; only the wrapper is new, and `shrink-0` moves off the buttons onto the wrapper:

```tsx
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          onClick={() => toggleVisible(layer.category, look)}
          aria-label={layer.visible ? "Hide layer" : "Show layer"}
          aria-pressed={layer.visible}
          data-testid={`toggle-visible-${layer.category}`}
          className="rounded-full p-2 text-textSecondary transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/* keep both existing SVG branches here, unchanged */}
        </button>
        <button
          onClick={() => removeLayer(layer.category, look)}
          aria-label={`Remove ${layer.product.name}`}
          data-testid={`remove-${layer.category}`}
          className="rounded-full p-2 text-textSecondary transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      </div>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

---

### Task 6: Drawer gains add and view modes

The drawer currently only shows the catalog. It needs a second body — the target look's `LayerPanel` — because the on-page Active Layers container disappears below `md`. This task also closes the drawer if the viewport crosses to `md` or wider, which Task 4 (v1)'s review flagged as missing.

**Files:**
- Modify: `src/components/tryon/ProductDrawer.tsx` — props, a new effect, the caption, and the body

**Interfaces:**
- Consumes: `LayerPanel` from `@/components/layers/LayerPanel` (props: `{ look: LookId }`).
- Produces: `<ProductDrawer products={CatalogProduct[]} look={LookId} mode={"add" | "view"} showTarget={boolean} onClose={() => void} />`. Task 8 passes `mode`.

- [ ] **Step 1: Add the import and the `mode` prop**

Add to the imports in `src/components/tryon/ProductDrawer.tsx`:

```tsx
import { LayerPanel } from "@/components/layers/LayerPanel";
```

Add `mode` to the `Props` type, between `look` and `showTarget`:

```tsx
  /** `add` shows the searchable catalog; `view` shows the look's applied layers. */
  mode: "add" | "view";
```

and to the destructured parameter list, which becomes `{ products, look, mode, showTarget, onClose }`.

- [ ] **Step 2: Close the drawer when the viewport reaches `md`**

Add this effect directly below the existing `Escape`-key effect. Without it, opening the drawer on a narrow window and then widening leaves the sheet fixed over the desktop layout:

```tsx
  // The drawer is a phone-width affordance. If the viewport grows past `md`
  // — rotation, a foldable, a resized window — the desktop layout takes over
  // and the sheet must not be left floating above it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) onClose();
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [onClose]);
```

- [ ] **Step 3: Make the accessible label mode-aware**

Replace the panel's `aria-label={\`Add products to Look ${look}\`}` with:

```tsx
          aria-label={
            mode === "add" ? `Add products to Look ${look}` : `Look ${look} products`
          }
```

- [ ] **Step 4: Swap the body on mode**

Replace the whole block that currently runs from `<div className="shrink-0 px-5 pb-3">` through the closing `</div>` of the `ProductList` wrapper with the following. Add mode keeps the search field; view mode drops it, since there is nothing to search, and renders the layer panel instead:

```tsx
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
                  className="w-full rounded-pill border border-border bg-surface py-2 pl-4 pr-9 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
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
            showTarget && (
              <p className="shrink-0 px-5 pb-3 text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
                Look {look}
              </p>
            )
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
              <div className="px-5 pb-4">
                <LayerPanel look={look} />
              </div>
            )}
          </div>
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm test`
Expected: both pass. `npm run typecheck` will fail on `TryOnView`, which does not pass the new required `mode` prop until Task 8 — that single error is expected here. Report it; do not edit `TryOnView` in this task.

---

### Task 7: The look bar

Replace `AddProductBar` with `LookBar`: one control per look, split into a label region that opens the view drawer and a `＋` that opens the add drawer.

**Files:**
- Delete: `src/components/tryon/AddProductBar.tsx`
- Create: `src/components/tryon/LookBar.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<LookBar showBoth={boolean} activeLook={LookId} bothEnabled={boolean} hasProducts={boolean} onView={(look: LookId) => void} onAdd={(look: LookId) => void} />`. Task 8 mounts it.

- [ ] **Step 1: Delete the superseded component**

Delete `src/components/tryon/AddProductBar.tsx`. Task 8 removes its last import.

- [ ] **Step 2: Write `LookBar`**

Create `src/components/tryon/LookBar.tsx`:

```tsx
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
  "flex-1 truncate px-4 py-2.5 text-left text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";
const PLUS =
  "flex w-10 shrink-0 items-center justify-center border-l border-border text-sm font-bold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

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
          data-testid="add-products-button"
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
          data-testid="view-products-button"
          className={LABEL}
        >
          View Products
        </button>
        <button
          type="button"
          onClick={() => onAdd(activeLook)}
          aria-label="Add products"
          data-testid="add-products-button"
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
              aria-label={`Add products to Look ${lk}`}
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
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: passes. `npm run typecheck` will still fail on `TryOnView`'s now-dangling `AddProductBar` import until Task 8 — that is expected here.

---

### Task 8: Wire the look bar and drawer modes into `TryOnView`

Mount `LookBar`, hold the drawer's target *and* mode, hide the Active Layers container below `md`, and fix the stale `swapped` flag.

**Files:**
- Modify: `src/components/tryon/TryOnView.tsx` — imports, state, a new effect, the trigger row, the layers container, the drawer mount

**Interfaces:**
- Consumes: `<LookBar …>` from Task 7, `<ProductDrawer … mode={…}>` from Task 6.
- Produces: terminal task.

- [ ] **Step 1: Fix the imports**

In `src/components/tryon/TryOnView.tsx`, replace the `AddProductBar` import with `LookBar`. The `ProductSearchBar` and `ProductDrawer` imports stay:

```tsx
import { LookBar } from "./LookBar";
```

Also add `useEffect` to the React import, so it reads:

```tsx
import { useEffect, useState } from "react";
```

- [ ] **Step 2: Replace the drawer state with target + mode**

Replace the `const [drawerLook, setDrawerLook] = useState<LookId | null>(null);` line with a single object, so the two can never disagree:

```tsx
  // Which look the phone-width drawer targets and what it is showing; null when closed.
  const [drawer, setDrawer] = useState<{ look: LookId; mode: "add" | "view" } | null>(null);
```

- [ ] **Step 3: Reset the stale swap target**

Add this effect directly below the `drawer` state declaration:

```tsx
  // `swapped` points at Look B, and the swap control only renders while Look B
  // has layers. Clearing Look B while swapped would otherwise strand the tab on
  // an empty look with no way back.
  useEffect(() => {
    if (swapped && looks.B.length === 0) setSwapped(false);
  }, [swapped, looks.B.length]);
```

- [ ] **Step 4: Swap the trigger row for the look bar**

Replace the `md:hidden` wrapper that currently renders `AddProductBar` with:

```tsx
          <div className="shrink-0 md:hidden">
            <LookBar
              showBoth={viewMode === "split" || hasB}
              activeLook={activeLook}
              bothEnabled={viewMode === "split"}
              hasProducts={looks[activeLook].length > 0}
              onView={(look) => setDrawer({ look, mode: "view" })}
              onAdd={(look) => setDrawer({ look, mode: "add" })}
            />
          </div>
```

Leave the sibling `hidden shrink-0 md:block` wrapper holding `ProductSearchBar` exactly as it is.

- [ ] **Step 5: Hide the Active Layers container below `md`**

The layers block renders one of two branches. On the split/both branch, change `className="flex min-h-0 flex-1 gap-3"` to:

```tsx
            <div className="hidden min-h-0 flex-1 gap-3 md:flex">
```

On the single-look branch, change `className="flex min-h-0 flex-1 flex-col rounded-card border border-border p-3"` to:

```tsx
            <div className="hidden min-h-0 flex-1 flex-col rounded-card border border-border p-3 md:flex">
```

Everything inside both branches is unchanged — below `md` the same content is reachable through the drawer's view mode.

- [ ] **Step 6: Mount the drawer with its mode**

Replace the `{drawerLook && ( … )}` block with:

```tsx
      {drawer && (
        <ProductDrawer
          products={products}
          look={drawer.look}
          mode={drawer.mode}
          showTarget={viewMode === "split" || hasB}
          onClose={() => setDrawer(null)}
        />
      )}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass, including the errors Tasks 6 and 7 deliberately deferred to this task.

Browser verification is run by the controller.
