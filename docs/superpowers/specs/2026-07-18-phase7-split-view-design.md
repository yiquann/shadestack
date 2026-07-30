# Phase 7: Split-View & Before/After Comparison — Design

## Goal

Roadmap item 7: split-view comparison. Add two on-face comparison modes to Try On:

1. **Before/after wipe (single look):** a draggable vertical line over the preview; makeup renders
   on one side, the bare face on the other, so the user can wipe between before and after.
2. **Split view (two looks):** the face is split down its **true, tilting midline** (from
   landmarks) — **Look A on the left half, Look B on the right** — for real-time A/B comparison. A
   toggleable divider line marks the axis; the 50/50 A/B layer split holds whether the line is shown
   or not.

A button swaps between **Single** and **Split** view. In split, products are added to a chosen
side, both looks are editable, and clearing a look first offers to save it.

## Decisions (locked in brainstorming)

- Both comparison modes ship in this phase.
- Split divider is the **true face midline that tilts** with head rotation (not a fixed vertical or
  screen center).
- **Left = Look A, Right = Look B**, shown as a legend note ("\*Left = Look A · Right = Look B"). A
  **Swap sides** button exchanges which side each look renders on (legend updates).
- Editing target is chosen per-add: in split, a product's **Try On** button becomes **"+ Look A"**
  and **"+ Look B"**. The Active Layers panel shows **Look A and Look B side by side** in the same
  container, each independently editable.
- **Clear Look** opens a confirmation that offers to **save first**; in split it asks per-look
  (Save A / B / Both), then clears. Saving persists to a **minimal localStorage saved-looks store**
  now (Phase 9's Saved tab will later read/display it).

## Phasing (7.1 / 7.2)

This design is delivered in two sub-phases, built in order:

- **7.1 — Split view.** The two-look state model (`looks.{A,B}` + `mode` + look-targeted actions +
  v1→v2 migration), the `regionClip` render primitive, the tilting-midline half-plane mask +
  `midline` endpoints, split render integration in the sources/camera loop, and the split UI
  (Single↔Split toggle, Swap sides, divider toggle, legend, +Look A/+Look B add buttons, two-look
  side-by-side Active Layers). In 7.1, **Clear Look** stays simple — clears Look A in single mode and
  clears both looks in split mode (no dialog yet).
- **7.2 — Before/after wipe + save-on-clear.** The `buildWipeMask` rectangle region (reusing 7.1's
  `regionClip`), the draggable `BeforeAfterWipe` handle + wipe toggle in single mode, the
  `savedLooks` localStorage store, and the `ConfirmDialog` that turns Clear Look into a
  save-first / A·B·Both confirmation.

Files below are annotated with their sub-phase where it isn't obvious.

## Architecture

```
src/
  lib/
    tryon/
      session.ts                # pure look-transition fns, now look-targeted (modified)
      TryOnSessionContext.tsx    # two looks + mode + saved-looks store (modified)
      savedLooks.ts              # minimal saved-looks store (localStorage) (new)
      savedLooks.test.ts         # (new)
    webgl/
      compositor.ts              # Layer gains regionClip; drawMask applies it (modified)
      regionMask.ts              # half-plane (tilting midline) + wipe-rect mask builders (new)
      regionMask.test.ts         # (new)
      glLayers.ts                # buildGlLayers gains a regionClip param (modified)
    facemesh/
      midline.ts                 # midline endpoints from landmarks (new)
      midline.test.ts            # (new)
  components/
    tryon/
      TryOnView.tsx              # mode toggle, split wiring (modified)
      SplitControls.tsx          # Single/Split toggle, Swap sides, divider toggle, legend (new)
      BeforeAfterWipe.tsx        # draggable wipe handle overlay (new)
      RenderCanvas.tsx           # accepts a render description (mode/looks/region) (modified)
      CameraSource.tsx           # loop renders per mode (modified)
      ProductSearchBar.tsx       # drawer cards add to a chosen look in split (modified)
    catalog/
      ProductCard.tsx            # Try On -> +Look A / +Look B in split (modified)
    layers/
      LayerPanel.tsx             # single list, or two side-by-side look lists (modified)
      LayerRow.tsx               # actions target a specific look (modified)
    common/
      ConfirmDialog.tsx          # Clear-Look save/confirm dialog (new)
```

## State model

`TryOnSessionContext` moves from one `layers` array to two looks plus a mode:

```ts
type LookId = "A" | "B";
type ViewMode = "single" | "split";

type TryOnSessionValue = {
  looks: Record<LookId, AppliedLayer[]>;   // A and B
  mode: ViewMode;
  layersOf: (look: LookId) => AppliedLayer[];
  addProduct: (product: CatalogProduct, look: LookId) => void;
  removeLayer: (category, look: LookId) => void;
  setOpacity: (category, opacity, look: LookId) => void;
  toggleVisible: (category, look: LookId) => void;
  moveLayer: (from, to, look: LookId) => void;
  clearLook: (look: LookId) => void;
  setMode: (mode: ViewMode) => void;       // entering split copies A->B if B is empty
  saveLook: (look: LookId, name: string) => void;  // -> savedLooks store
};
```

- Today's single-look consumers target `"A"`. `looks.A` is the primary look.
- `setMode("split")` copies `looks.A` into `looks.B` when B is empty (a starting point).
- `looks`, `mode` persist to localStorage (existing `.v1` key bumped to `.v2`; a v1 payload — a bare
  `AppliedLayer[]` — is migrated into `looks.A`).
- `session.ts` pure functions are unchanged in shape (they already take a layer array and return a
  new one); the context routes each action to the targeted look's array.

`savedLooks.ts` is a tiny separate store: `getSavedLooks()`, `saveLook(name, layers)` →
`{ id, name, layers, createdAt }[]` persisted under `shadestack.saved.v1`. Pure helpers +
localStorage read/write, no UI (Phase 9 builds the Saved tab on top).

## Rendering

The compositor already clips a layer's mask to a `clipMask` (skin, for foundation). Add a second,
independent clip:

- `Layer.regionClip?: CanvasImageSource` — applied in `drawMask` as an additional `destination-in`
  after `clipMask`, so a layer is the intersection of (polygon − holes) ∩ skin ∩ region.
- `buildGlLayers(..., regionClip?)` sets `regionClip` on **every** emitted layer of a look.

Region masks (`regionMask.ts`), rasterized white on a reused canvas:

- **`buildHalfMask(canvas, p1, p2, side, w, h)`** — fills the half-plane on `side` ("left"/"right")
  of the line through `p1→p2` (the tilting midline), with a slightly feathered edge. Built by
  intersecting the midline with the canvas edges and filling the corner polygon on that side.
- **`buildWipeMask(canvas, x, w, h)`** — fills the rectangle `[0..x)` for the before/after wipe.

Midline endpoints (`midline.ts`): `midlineEndpoints(points, w, h)` → `{ top, bottom }` from stable
centre-line landmarks (forehead centre **10**, chin **152**), in canvas pixels.

Render per mode (one render pass each, base drawn once):

- **Single, no wipe:** `render(source, buildGlLayers(looks.A, …))` — unchanged.
- **Single, wipe on:** `render(source, buildGlLayers(looks.A, …, wipeMask))` — makeup only left of
  the wipe; bare face shows to the right.
- **Split:** `render(source, [ ...buildGlLayers(leftLook, …, leftHalfMask),
  ...buildGlLayers(rightLook, …, rightHalfMask) ])`, where left/right look = A/B (swapped if the
  user pressed Swap sides). Foundation still intersects its skin clip; every layer also intersects
  its half mask.

Overlays (divider line, wipe handle) are drawn **into the composite canvas** so they inherit the
camera's CSS mirror and stay aligned: an optional final pass strokes the midline (`p1→p2`) when the
divider toggle is on (split), or a vertical line at the wipe `x` (single). The **wipe handle** is
additionally a DOM element positioned at `x` for pointer dragging; on the mirrored camera its screen
x is mapped through the mirror.

## Component & UX flow

- **`SplitControls`** (below the face / in the control row): a **Single | Split** segmented toggle;
  in split, a **Swap sides** button, a **divider line** on/off toggle, and the legend note
  "\*Left = Look A · Right = Look B" (reflecting the current swap).
- **Before/after wipe** (single mode, when Look A has layers): a **`BeforeAfterWipe`** handle the
  user drags horizontally; the preview clips makeup to the handle position live. A small toggle
  enables the wipe (off = normal full preview).
- **Product add:** `ProductCard`/`ProductSearchBar` — in single mode, one **Try On** (adds to A). In
  split mode, two buttons **"+ Look A" / "+ Look B"** add to that look.
- **Active Layers panel:** single mode → one list (today). Split mode → two labeled columns
  (Look A, Look B) side by side in the same container, each with its own draggable rows; `LayerRow`
  actions target its column's look.
- **Clear Look:** opens **`ConfirmDialog`**. Single: "Clear this look? · Save first · Clear ·
  Cancel". Split: choose which to clear (A / B / Both) with a Save checkbox per look; saving prompts
  for a name (default like "Look A") and writes to the saved-looks store before clearing.

## Camera / performance

Split renders both looks each frame (still one render pass; more layers + two extra region-mask
rasterizations). Combined with landmark tracking and segmentation this is the heaviest path — the
existing detection throttle, segmentation throttle, and 900px render cap still apply; region masks
are rebuilt only when landmarks (or the wipe x) change. Verify the FPS badge holds; if it dips, the
first lever is rasterizing region masks at reduced cadence like the skin mask.

## Testing

- **Unit (pure):** `session` look-routing (action targets the right look; entering split copies
  A→B); `savedLooks` (save appends a named entry; load returns it; v1→v2 migration); `midline`
  endpoints (correct landmarks, scaled to canvas); `regionMask` geometry where testable (wipe rect
  bounds; half-plane classifies sample points left/right of a known line — the pure point-side test,
  not the canvas raster).
- **Not unit-tested:** WebGL region compositing, the divider/wipe overlays, drag, and camera — all
  browser-only, covered by the live pass.
- **Verification (live):** before/after wipe reveals makeup vs bare and drags smoothly; split shows
  A left / B right along the tilting midline; divider toggle and Swap sides work; adding via
  +Look A/+Look B lands in the right look; both looks editable side by side; Clear Look saves then
  clears; FPS holds in split on camera.

## Success criteria

1. Single↔Split toggle; split renders Look A/Look B across the tilting face midline, 50/50.
2. Before/after wipe drags to reveal makeup vs bare in single mode.
3. Products add to the chosen look (+Look A / +Look B); both looks editable side by side.
4. Swap sides and divider-line toggle work; legend reflects state.
5. Clear Look confirms and can save each look to the localStorage saved-looks store first.
6. No `any` in the render pipeline; region clip composes with the existing skin clip; camera FPS
   target holds in split.

## Out of scope

The Saved tab UI and re-applying saved looks (Phase 9 — this phase only writes the store); shade
match (Phase 8); comparing more than two looks.
```
