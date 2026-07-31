# Mobile Product Drawer — Design

**Date:** 2026-07-30
**Status:** Approved, ready for implementation plan

## Problem

On the Try On tab, products are added through an always-visible search bar
(`ProductSearchBar`) whose results open as an absolutely-positioned dropdown
below it. That works on a wide screen, where the tab is a two-column layout with
the search bar heading its own column.

Below `md` the tab stacks into a single column inside a fixed,
non-scrolling `h-[calc(100dvh-5rem)]` main. The search bar then eats permanent
vertical space above the layer panels, and its dropdown — capped at `60vh` and
anchored to the bar rather than the viewport — overlaps the panels awkwardly. In
split view every result row also carries a `+ A` / `+ B` pair, doubling the
decisions per add on the narrowest screen.

## Solution

Below `md` (768px), replace the inline search bar with a trigger row of
look-targeted buttons. Tapping one opens a bottom drawer, capped at half the
screen, containing the search field and the catalog. Because the drawer already
knows which look it is adding to, each product row shows a single `Add` button.

At `md` and above nothing changes.

## Breakpoint & Layout Swap

768px — Tailwind's `md`, the same breakpoint at which `TryOnView` already flips
from `md:flex-row` to stacked. No new magic number is introduced.

The swap is pure CSS: both the trigger row (`md:hidden`) and the existing search
bar (`hidden md:block`) are rendered, and the breakpoint decides which is
visible. No media-query hook, so no SSR/hydration mismatch and no first-paint
flash. The drawer can only be opened by the mobile-only buttons, so it never
appears on desktop.

The trigger row replaces the `ProductSearchBar` wrapper currently at
`src/components/tryon/TryOnView.tsx:180-182`. Everything else on the tab — face
preview, control buttons, split controls, layer panels — keeps its current
mobile stacking.

### Trigger row contents

| Session state | Buttons |
|---|---|
| Split view | `+ Look A` and `+ Look B`, side by side, both enabled |
| Single view, both looks have layers | `+ Look A` and `+ Look B`, but only the active (swapped-to) look is enabled |
| Single view, only Look A has layers | a single `+ Add Products` |

Each button opens the drawer with its own `LookId` as the add target.

The single-with-both-looks row keeps both buttons in place rather than
collapsing to one. Leaving split view should not make a button disappear and
reflow the row; the pair stays, and the one you cannot currently edit simply
goes inactive. This is the same treatment the layer panels already use in that
state (`TryOnView.tsx:189-205`): the inactive side stays rendered at
`opacity-50` and is marked `inert`, captioned "swap to edit".

The disabled button therefore gets `disabled`, `opacity-50`, and
`title="Swap to edit Look B"` so the reason is discoverable — it cannot be
tapped, and the swap control directly above the row is what re-enables it.
Because a disabled button can never open the drawer, the drawer still cannot
target a look the user is not editing.

## The Drawer

New component: `src/components/tryon/ProductDrawer.tsx`. Props: the product
list, the target `LookId`, whether to show the target caption, and `onClose`.

Structure, top to bottom:

- **Scrim** — `bg-ink/30`, `fadeIn 0.2s ease-out`, z-index 60. Tapping it
  closes the drawer.
- **Panel** — `bg-surface`, `border-radius: 24px 24px 0 0`
  (`DESIGN_TOKENS.radii.sheet`), `slideUp 0.25s ease-out`, fixed to the bottom
  of the visual viewport, z-index 60.
- **Gripper** — the `h-1 w-10 rounded-full bg-border` bar used by
  `SaveLookSheet.tsx:70`, wrapped in a pointer-drag target with roughly a 24px
  tap height.
- **Search row** — the pill input and `✕` clear button from
  `ProductSearchBar.tsx:30-54`, reused as-is. Clearing restores the full
  catalog rather than closing anything.
- **Caption** — `Adding to Look B`, in the 11px uppercase `textMuted` section
  label style. Rendered only when both looks are in play (split view, or single
  view where Look B has layers); omitted when there is only one look, where it
  would be noise.
- **List** — `ProductList`, the only scrolling region in the panel
  (`overflow-y-auto`, `min-h-0`).

### Behavior

- **Opens showing the full catalog.** Typing filters it live through the
  existing `searchProducts` helper.
- **The search field is not autofocused.** Since the drawer is browsable
  without typing, the keyboard stays down until the user taps the field. This
  is deliberate: autofocusing would immediately cover the list the drawer just
  opened to show.
- Adding a product does **not** close the drawer — users commonly add several
  products in a row, and the layer panels behind the scrim are not visible
  anyway.
- `Escape` closes. Body scroll is locked while open. Focus returns to the
  trigger button that opened it.
- `role="dialog"`, `aria-modal="true"`, `aria-label="Add products to Look A"`
  (target interpolated).

Tapping a product row opens `ProductDetailSheet` on top of the drawer at
z-index 70, above the drawer's 60. The z ladder is: bottom nav 50, drawer 60,
sheets 70.

## Geometry & Keyboard Handling

A `visualViewport` listener (`resize` and `scroll` events) in a new
`src/lib/tryon/useVisualViewport.ts` hook feeds a pure function in
`src/lib/tryon/drawerGeometry.ts`:

```ts
computeDrawerGeometry({ innerHeight, viewportHeight, viewportOffsetTop })
  → { bottomInset, height, hasScrim }
```

- `bottomInset = max(0, innerHeight - viewportHeight - viewportOffsetTop)` —
  the on-screen keyboard's height, zero when it is closed.
- `height = min(0.5 * innerHeight, viewportHeight)` — the half-screen cap,
  clamped to the visible viewport so a tall keyboard can never push the
  drawer's top edge off-screen.
- `hasScrim = height < viewportHeight` — whether any visible space remains
  above the panel.

The panel is positioned with `bottom: bottomInset` and an explicit `height`, so
opening the keyboard lifts the whole drawer instead of covering its list.

When `visualViewport` is unavailable, the hook falls back to `innerHeight` for
both measurements, producing a plain 50vh drawer at `bottom: 0` — the desktop
and older-browser case.

`hasScrim` controls only whether the scrim element is rendered. It does **not**
gate the gripper: dragging works in every state.

## Drag to Close

Pointer events on the gripper, resolved by a second pure function in
`drawerGeometry.ts`:

```ts
resolveDrag({ deltaY, height, velocity }) → "close" | "snap-back"
```

- Dragging down translates the panel 1:1. Upward drag is clamped to 0 — the
  drawer never grows past its cap.
- On release it closes if `deltaY` exceeds 25% of panel height, or if velocity
  exceeds 0.5 px/ms (a flick). Otherwise it springs back over 0.2s.
- Dismissing blurs the search input first, so the keyboard retracts along with
  the drawer instead of lingering over the tab.

Both close paths — scrim tap and gripper drag — are live simultaneously
whenever their affordance is present. When the keyboard leaves no space above
the panel there is no scrim to tap, and the gripper is the only way out; that
falls out of the geometry rather than needing a mode switch.

## Product Row Changes

`ProductCard` currently derives its add UI as
`splitAdd = !asLink && mode === "split"`, which renders the `+ A` / `+ B` pair.
The drawer needs one button targeting a known look, so two additive optional
props thread through `ProductList` to `ProductCard`:

- `singleAdd?: boolean` — when true, always render one add button targeting the
  `look` prop, even in split mode.
- `addLabel?: string` — defaults to `"Try On"`; the drawer passes `"Add"`.

Both default to today's behavior, so Discover, the search overlay, the similar
carousel, and the desktop `ProductSearchBar` are unaffected.

## Files

**New**

- `src/components/tryon/ProductDrawer.tsx` — scrim, panel, gripper, search row, list
- `src/components/tryon/AddProductBar.tsx` — the `md:hidden` trigger row
- `src/lib/tryon/drawerGeometry.ts` — `computeDrawerGeometry`, `resolveDrag`
- `src/lib/tryon/drawerGeometry.test.ts`
- `src/lib/tryon/useVisualViewport.ts` — `visualViewport` subscription hook

**Edited**

- `src/components/tryon/TryOnView.tsx` — swap the search row for the trigger
  row, hold drawer open/target state
- `src/components/catalog/ProductList.tsx` — pass through `singleAdd`, `addLabel`
- `src/components/catalog/ProductCard.tsx` — honor `singleAdd`, `addLabel`

**Unchanged**

- `src/components/tryon/ProductSearchBar.tsx` — desktop keeps it verbatim

## Testing

Vitest runs with `environment: "node"`, so there is no DOM harness and
components are not unit-testable in this repo. Coverage lands on the pure
geometry functions in `drawerGeometry.test.ts`:

**`computeDrawerGeometry`**

- Keyboard closed (`viewportHeight === innerHeight`): `bottomInset` 0, `height`
  is half of `innerHeight`, `hasScrim` true
- Keyboard open, short: `bottomInset` equals the keyboard height, `height`
  still the 50% cap, `hasScrim` true
- Keyboard open, tall (visible viewport under half the screen): `height`
  clamps to `viewportHeight`, `hasScrim` false
- Non-zero `viewportOffsetTop` (pinch-zoom scroll) is subtracted from the inset
- Fallback inputs where `viewportHeight === innerHeight` and offset is 0
  reproduce the plain 50vh case

**`resolveDrag`**

- `deltaY` just under and just over the 25%-of-height threshold
- A fast flick under the distance threshold still closes
- A slow drag under the threshold snaps back
- Negative (upward) `deltaY` snaps back

Manual verification, since it cannot be automated here: at ≥768px the tab is
unchanged; below 768px the trigger row appears and the drawer opens, filters,
adds to the correct look, and closes by scrim tap, gripper drag, and Escape.
Building a split look and then switching back to single view must leave both
buttons in place with only the active look's button enabled, and swapping must
move which one is disabled. Keyboard lift needs a physical phone.

## Out of Scope

- Any change to the tab at `md` and above
- Category chips or filters inside the drawer — search only, matching the bar
  it replaces
- Persisting the drawer's query across opens
- Touching the Discover tab's search overlay
