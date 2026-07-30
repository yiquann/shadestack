# Phase 5: Active Layers Panel + Add Products Loop — Design

## Goal

Roadmap item 5 is "Layer panel: toggle → opacity → drag-to-reorder." Today `RenderCanvas`
renders six hardcoded demo layers with hand-picked colors — no connection to real catalog
products, and no way for a user to build or edit a look. This phase makes the Try On tab's
"Active Layers" panel real: users can add real products (from Discover or a new in-tab Add
Products section), see them rendered on the Model face via the Phase 4 WebGL pipeline, toggle
visibility, adjust per-layer opacity, drag-reorder the stack, remove a layer, and clear the
whole look. Session state persists across reloads via `localStorage`.

**Explicitly out of scope for this phase:** the "Complete Your Look" complementary-category
suggestion carousel (CLAUDE.md describes it; deferred to its own later phase per discussion).
Photo/Camera mode, split-view, shade match, and Saved looks/products remain untouched
(roadmap items 6–9).

## Architecture

```
src/
  lib/
    tryon/
      session.ts              # pure state-transition functions (new)
      TryOnSessionContext.tsx # React context + localStorage persistence (new)
    webgl/
      categoryZones.ts        # category -> zone(s)/blendMode/baseOpacity/feather config (new)
      compositor.ts           # unchanged
  components/
    layers/
      LayerPanel.tsx          # Active Layers section (new)
      LayerRow.tsx            # one draggable row (new)
    tryon/
      TryOnView.tsx           # client composition root for the tab (new)
      AddProductsSection.tsx  # chips + search + list, in-tab (new)
      RenderCanvas.tsx        # now consumes real session layers (modified)
      FaceMeshTracker.tsx     # passes points/image up to TryOnView (modified)
    catalog/
      ProductCard.tsx         # "Try On" now also calls addProduct (modified)
    detail/
      ProductDetailSheet.tsx  # "Try On" now also calls addProduct (modified)
  app/
    (tabs)/
      layout.tsx              # wraps children in TryOnSessionProvider (modified)
      try-on/page.tsx         # becomes async server component fetching products (modified)
```

## Data model

```ts
// src/lib/tryon/session.ts
import type { CatalogProduct } from "@/lib/catalog/types";

export type AppliedLayer = {
  category: CatalogProduct["category"];
  product: CatalogProduct;   // full snapshot — see rationale below
  opacity: number;           // 0–1, default 1 (the per-layer slider)
  visible: boolean;          // default true
};

export type Session = { layers: AppliedLayer[] };
```

**Why a full product snapshot, not just an id:** the session is a client-side working
draft (distinct from the Prisma `SavedLook` model in CLAUDE.md, which stores a
`{category: productId}` map for *persisted, named* looks — a separate, later feature).
Storing the full object here means a `localStorage`-restored session always renders
correctly with zero re-fetching, even if the catalog changes elsewhere. This asymmetry
(snapshot here vs. id there) is intentional, not an oversight — `SavedLook` needs to survive
catalog edits by re-resolving current product data; this working session does not.

**Ordering convention:** `layers[0]` is the bottom of the visual stack, `layers[length-1]`
is the top (matches CLAUDE.md: "bottom = foundation, top = lipstick by default"). The
`LayerPanel` UI displays the array **reversed** (top-of-stack first in the list), matching
common layer-panel conventions (Figma/Photoshop).

**Default z-order** (used only when inserting a genuinely new category, not on reorder):

```
FOUNDATION < SETTING_POWDER < BRONZER < BLUSH < HIGHLIGHTER < EYESHADOW < LIPSTICK
```

### Pure functions (`session.ts`) — unit-testable without React

- `applyProduct(layers: AppliedLayer[], product: CatalogProduct): AppliedLayer[]`
  If `product.category` already has a layer, replace its `product` in place (same array
  index, same `opacity`/`visible` — swapping shades keeps your slider position). Otherwise
  insert a new `AppliedLayer` (`opacity: 1, visible: true`) at the position implied by the
  default z-order table above, relative to whatever categories are already present.
- `removeLayer(layers, category): AppliedLayer[]` — drop the entry for `category`.
- `setOpacity(layers, category, opacity): AppliedLayer[]` — clamp `opacity` to `[0, 1]`.
- `toggleVisible(layers, category): AppliedLayer[]`
- `moveLayer(layers, fromCategory, toCategory): AppliedLayer[]` — reorders by moving the
  `fromCategory` entry to sit at `toCategory`'s current index (the operation `@dnd-kit`
  drag-end reports).
- `clearLook(): AppliedLayer[]` — returns `[]`.

All are pure `(layers, ...) => newLayers` — no class, no mutation of the input array.

## `TryOnSessionContext.tsx`

A `"use client"` Context provider wrapping the `(tabs)` layout's children. Internally holds
`layers` in `useState`, calling the `session.ts` functions above for every mutation.

**Persistence:** on mount, a `useEffect` reads `localStorage["shadestack.tryon.session.v1"]`,
`JSON.parse`s it inside a `try/catch` (any failure — missing key, corrupt JSON, wrong shape —
falls back to `[]`, never throws), and sets state. A second `useEffect` (keyed on `layers`)
writes the current state back on every change. The initial render (before hydration) always
starts from `[]` to avoid an SSR/CSR mismatch; the localStorage read happens client-side only,
after mount — so there's a one-frame flash from empty to restored on reload, which is
acceptable for a v1.

**Exposed hook:** `useTryOnSession()` returns
`{ layers, addProduct, removeLayer, setOpacity, toggleVisible, moveLayer, clearLook }`.

## `categoryZones.ts` — category → render config

Replaces Phase 4's hardcoded per-zone demo layer list in `RenderCanvas` with a lookup table,
using the exact zone/opacity/blend/feather values Phase 4 already validated visually (Task 4's
implementer additionally fixed the eye zone landmarks and confirmed the forehead/jawline and
left/right-cheek split-draw approach — this config reuses those same, now-correct,
`ZONE_LANDMARKS` entries as-is, not new indices):

| Category | Zone draws (zone, featherPx) | Blend | Base opacity |
|---|---|---|---|
| `FOUNDATION` | `faceOval`, 8 | multiply | 0.18 |
| `SETTING_POWDER` | `faceOval`, 8 | multiply | 0.06 |
| `BRONZER` | `forehead`, 14 + `jawline`, 14 (two draws) | multiply | 0.18 |
| `BLUSH` | `leftCheek`, 12 + `rightCheek`, 12 (two draws) | multiply | 0.32 |
| `HIGHLIGHTER` | `leftCheek`, 10 + `rightCheek`, 10 (two draws) | screen | 0.25 |
| `EYESHADOW` | `leftEye`, 3 + `rightEye`, 3 (two draws) | multiply | 0.32 |
| `LIPSTICK` | `lips`, 2 | multiply | 0.55 |

```ts
export type CategoryZoneEntry = { zone: ZoneName; featherPx: number };
export const CATEGORY_RENDER: Record<
  CatalogProduct["category"],
  { entries: CategoryZoneEntry[]; blendMode: BlendMode; baseOpacity: number }
> = { /* table above */ };
```

## `RenderCanvas.tsx` changes

`RenderCanvas` now takes `layers: AppliedLayer[]` (from `useTryOnSession()`, read by its
parent `TryOnView`) instead of building a fixed demo array. Inside the existing `useEffect`:

```ts
const glLayers: Layer[] = layers
  .filter((l) => l.visible)
  .flatMap((l) => {
    const config = CATEGORY_RENDER[l.category];
    return config.entries.map(({ zone, featherPx }) => ({
      polygon: landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height),
      tintColor: hexToRgb01(l.product.colorHex),
      opacity: config.baseOpacity * l.opacity,
      blendMode: config.blendMode,
      featherPx,
    }));
  });
renderComposite(canvas, image, glLayers);
```

`layers` (in session order, bottom-to-top) already produces correct paint order since
`flatMap` preserves array order and `renderComposite` draws sequentially. An empty `layers`
array (no products applied yet) renders the base face image with no tint layers — already
correct behavior, no special-case needed.

## Components

### `LayerPanel.tsx`

```ts
function LayerPanel(): JSX.Element   // reads useTryOnSession() itself, no props
```

- Empty state (`layers.length === 0`): a short message ("No products applied yet — add one
  below to start your look") in `textMuted`, matching the Saved tab's empty-state tone.
- Otherwise: a `@dnd-kit` `<DndContext onDragEnd={...}>` wrapping a
  `<SortableContext items={reversedCategories} strategy={verticalListSortingStrategy}>` of
  `LayerRow`s, iterated over `[...layers].reverse()` (top-of-stack first).
  `onDragEnd` calls `moveLayer(active.id, over.id)` (ids are `category` strings — unique
  since one-product-per-category is enforced).
- A "Clear Look" button below the list, calling `clearLook()`. Rendered only when
  `layers.length > 0`.

### `LayerRow.tsx`

```ts
type Props = { layer: AppliedLayer };
function LayerRow({ layer }: Props): JSX.Element
```

Uses `useSortable({ id: layer.category })` internally for the drag handle. Row contents,
left to right: drag handle (⠿ icon, `{...attributes} {...listeners}`), colorHex swatch
(reuses `ProductCard`'s domed-gradient thumbnail style), product name + category label
stacked, an opacity `<input type="range" min={0} max={100}>` bound to `layer.opacity * 100`
(calls `setOpacity(layer.category, value / 100)`), a visibility toggle (eye icon button
calling `toggleVisible`), and a remove ✕ button calling `removeLayer`.

### `AddProductsSection.tsx`

```ts
type Props = { products: CatalogProduct[] };
function AddProductsSection({ products }: Props): JSX.Element
```

Reuses `CategoryChips`, `SearchOverlay`, `ProductList` from `components/catalog/` verbatim
(same local `activeCategory`/`searchOpen` state pattern as `DiscoverView`). Rendered below
`LayerPanel` in the Try On tab. `ProductList`'s `onSelect` opens `ProductDetailSheet` (same
as Discover), whose own "Try On" button (see below) adds the product.

### `ProductCard.tsx` / `ProductDetailSheet.tsx` — wiring change

Both already render a "Try On" `<Link href="/try-on">`. Add an `onClick` that calls
`useTryOnSession().addProduct(product)` before/alongside navigation (no `preventDefault` —
letting the `Link` navigate is harmless; when already on `/try-on` it's a no-op route
change). This is the only change to these two files.

### `TryOnView.tsx` (new) + `try-on/page.tsx` (modified)

`try-on/page.tsx` becomes an async server component, mirroring `discover/page.tsx`:

```ts
export default async function TryOnPage() {
  const products = await prisma.product.findMany();
  return <TryOnView products={products.map(toCatalogProduct)} />;
}
```

`TryOnView` (client component) composes `ModeSourcePicker`, `FaceMeshTracker` (which renders
`RenderCanvas`, now reading `layers` via `useTryOnSession()`), `LayerPanel`, and
`AddProductsSection`, in that order — matching CLAUDE.md's described Try On tab layout.

### `(tabs)/layout.tsx`

Wrap existing children in `<TryOnSessionProvider>`.

## New dependency

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — chosen over hand-rolled HTML5
drag events (weak mobile Safari support, this is a mobile-first app) and over up/down
buttons (doesn't match "drag handle" from CLAUDE.md's architecture notes / the roadmap
wording).

## Error handling

- Corrupt/missing `localStorage` → empty session, no throw (see Context section above).
- Zero applied layers → `RenderCanvas` renders the base face only; `LayerPanel` shows its
  empty state. No special-casing needed beyond what's described above.
- A product's `colorHex` is always present (non-nullable in `CatalogProduct`), so
  `hexToRgb01` never receives `undefined`.

## Testing

**Vitest** (pure logic, no React/DOM):
- `session.test.ts` — `applyProduct` (new category inserts at correct default z-order
  position; existing category replaces in place, preserving opacity/visible), `removeLayer`,
  `setOpacity` (clamping), `toggleVisible`, `moveLayer`, `clearLook`.
- `categoryZones.test.ts` — every `CatalogProduct["category"]` has a `CATEGORY_RENDER` entry
  (exhaustiveness), and the table's values match the CLAUDE.md Rendering Fidelity Targets
  table above.

**Playwright** (against a live dev server, extending the Phase 3/4 pattern):
- From Discover, click "Try On" on a product; confirm it appears in the Try On tab's layer
  list and the canvas's non-transparent pixel count changes.
- Toggle a layer off → confirm the corresponding tint disappears from a pixel-region check
  (reusing the kind of pixel-diff check Task 4's implementer already used for the highlighter
  screen-blend verification).
- Adjust an opacity slider → confirm the rendered tint's alpha changes proportionally.
- Drag-reorder two layers → confirm paint order changes (e.g. a layer that was fully covered
  by another becomes visible after being moved above it).
- Remove a layer, then Clear Look → confirm the panel empties and the canvas returns to an
  untinted base face.
- Reload the page after applying products → confirm the session (and its render) persists
  via `localStorage`.

## Self-Review

**Placeholder scan:** none — every section has concrete types, exact values, and file paths.

**Internal consistency:** the ordering convention (`layers[0]` = bottom) is stated once and
used consistently in `applyProduct`'s insertion logic, `RenderCanvas`'s paint loop, and
`LayerPanel`'s reversed display. The `CATEGORY_RENDER` table's opacity/blend/feather values
match both CLAUDE.md's Rendering Fidelity Targets and Phase 4's already-shipped, visually
verified values — not reinvented.

**Scope check:** focused on one phase — session state, the panel, the add-products loop, and
the two "Try On" button wiring points. "Complete Your Look" is explicitly excluded, not
partially built.

**Ambiguity check:** the one previously-open question (opacity/visibility carryover on
product replacement within a category) is resolved explicitly (preserved, not reset).
