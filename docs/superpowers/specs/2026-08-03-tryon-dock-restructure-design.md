# Try-On dock restructure (phone) — design

**Date:** 2026-08-03
**Scope:** phone widths only (`< md`), all three sources (Model / Photo / Camera).
The `md+` two-column layout — inline search bar plus the Look A / Look B layer
panels — is untouched.

## Problem

Everything below the face preview grows and shrinks with state:

- The preview is sized from whatever viewport space is left over, so every
  control that appears in Split mode shrinks it.
- The controls below it occupy one, two or three rows depending on view mode and
  whether products are applied.
- Buttons appear and disappear between modes. Swap and divider only exist in
  Split, which both causes reflow and hides the fact that Split exists at all.
- `Save Look` and `Clear Look` share a row that only exists once products are
  applied — so the photo shrinks at exactly the moment the user most wants to
  see it.
- The `*Left = Look A · Right = Look B` caption costs a row and states the
  mapping rather than the current contents; it does not survive a swap.
- `Clear Look` is ambiguous in Split (clear which look?) and its glyph collides
  with the photo's remove-`✕`.

## Goal

The area below the header keeps exactly one shape. The preview never resizes in
response to a mode toggle, a swap, or a product being applied. Every control
that exists is on screen at all times, in one of two states.

## Layout

```
main  (flex column, fills .app-shell)
├─ header   shrink-0    "Try On"  +  [Model | Photo | Camera]
├─ stage    flex-1 min-h-0        aspect-locked preview
└─ dock     shrink-0  height: var(--dock-h)
   ├─ Row 1   [Single | Split]        ◫  ⇄  ♡
   └─ Row 2   look slots
```

### Stage height

`--dock-h` is a single constant token, measured from the **Split** layout (the
tallest dock state) during implementation. Because the dock can no longer change
height with mode or content, the free space above it is constant, and the
existing `useFitHeight` `ResizeObserver` measurement that sizes the preview
yields the same value in every mode.

**This is deliberately not `--stage-h: calc(100dvh - header - tabs - dock - nav)`.**
Every term in that expression is a hardcoded guess at a real element's height.
The codebase carries that scar twice over — see the comment in
`src/lib/tryon/useFitHeight.ts` describing the `100dvh - 22rem` guess that
over-ran on short viewports and pushed controls behind the tab bar, and the
`height: 100vh / 100dvh` comment in `globals.css`. Fixing the *dock* and letting
the browser derive the stage gives the identical guarantee — the stage never
resizes on mode toggle — with one measured number instead of five guessed ones.

Starting estimate for `--dock-h` is ~7rem (Row 1 `h-10` icon buttons, Row 2
chips at `py-3`, plus row gap and vertical padding); the token is set from the
real measured Split layout in task 1.

### Dock affordance

**Undrawn.** The original plan was a hairline top border plus a slight
background shift, so the reserved space would read as a fixed panel rather than
an empty gap. In practice the preview's own frame already marks that division:
the stage bottom-aligns its content, so the frame's lower edge sits exactly on
the dock boundary, and a painted rule would only sit directly beneath it.

Two consequences for the source components:

- The stage's fit wrapper uses `items-end`, not `items-center`. The box is
  aspect-locked, so when the column's width is the binding constraint there is
  leftover height; it now pools entirely above the frame instead of being split
  above and below.
- Status copy moved out from below the frame, in all three sources — nothing may
  sit between the frame and the boundary it is supposed to land on. Model and
  Camera place their (conditional) messages above the frame. Photo overlays its
  message on the frame instead, because its status line was *reserved*: that
  24px made Photo's measured free height 24px smaller than Camera's, and since
  width derives from height, its frame came out 24px shorter and 18px narrower
  than Camera's. Overlaying keeps the two sources geometrically identical while
  preserving the reason the line was reserved in the first place — the photo
  must not resize when "Analyzing photo…" appears and clears.

The boundary itself is unchanged: the dock still reserves exactly `--dock-h`
whether or not it is full.

## Row 1 — mode and actions

Left: the `[Single | Split]` segment. Right: `◫` orientation, `⇄` swap, `♡` save.
All four render at all times, in every mode, in both the empty and populated
states.

Define `hasAny` — one rule in both modes: Look A **or** Look B is non-empty.

Enablement:

| Control | Enabled when | Rationale |
|---|---|---|
| `[Single \| Split]` | always | |
| `⇄` swap | Split only | Nothing to exchange in Single. |
| `◫` orientation | `hasAny` | A before/after divider does nothing visible when both halves are the bare photo. |
| `♡` save | `hasAny` | Nothing to save. |

`◫` keeps its current dual meaning: in Split it shows/hides the white midline
divider; in Single it toggles the before/after wipe. No renderer change.

`hasAny` is mode-independent because Single always renders a populated look
whenever one exists — see *Primary look* below. There is therefore no state in
which products exist but the save and orientation controls are dead.

### Shared disabled treatment

One rule, so the user learns a single visual grammar for "unavailable here":

- background `--color-chip-strong` (`#DCD6D0`) instead of `chip` — **and nothing else**
- `pointer-events: none`
- `aria-disabled="true"`
- the click handler early-returns

Every icon button keeps its circular hairline border and its full-strength
`textSecondary` glyph in every state. An unavailable control therefore still
reads as a button with a legible symbol, which is the point — swap and split
were previously invisible until you found them, and the whole reason to render
them disabled is to advertise that those modes exist.

**Revised twice after seeing it on device.** First implementation was
`opacity: 0.38` on the chip fill, on the theory that dimming preserves the
icon's shape. Against a palette this warm and low-contrast it was not noticeable
enough to read as "unavailable." Second was the grey fill *plus* a muted
`textMuted` glyph; that read as unavailable but cost the icon its definition.
The fill alone, with the border and glyph left intact, is the version that
holds.

A new colour token was added rather than a hardcoded hex, per the project's
colour rule; the palette had no neutral, and against these creams a desaturated,
slightly cooler grey is what reads as inert.

**One fill for both hover and unavailable.** `chip-strong` is also every dock
control's hover state — the mode segments, the icon buttons, and both halves of
each look chip. A control is either at rest (`chip`) or pressed back
(`chip-strong`): one step, one colour, nothing to misread as a third state. Its
distance from `chip` is roughly twice `chipHover`'s, which is what makes it
register; a `tokens.test.ts` assertion pins that ratio so the value cannot drift
back toward `chip`.

The accepted cost: on a pointer device, hovering an available control briefly
resembles an unavailable one. The dock is a phone surface and phones have no
hover, so the collision does not arise where it matters.

`pointer-events: none` alone does not stop keyboard activation, hence the
handler guard. The button stays focusable (no `tabIndex={-1}`, no `disabled`
attribute) so assistive technology announces that the control exists and is
currently unavailable — the same information the grey conveys visually.

## Row 2 — look slots

One row, always present, whose contents change shape. Both shapes are a single
row of chips, so the dock height is unaffected.

Each chip is a label plus a persistent `＋`. **No product counts.** The label
opens the drawer in `view` mode for that look; the `＋` opens it in `add` mode.
An empty look's label still opens the drawer — it shows the layer panel's
existing empty state.

### Primary look

Single mode renders the look the user actually has:

```
primaryLook = A non-empty ? "A" : B non-empty ? "B" : "A"
```

Rendering Look A unconditionally would break one real state: build products only
in Look B in Split, switch to Single, and you get the bare photo with your
products nowhere on screen — the app appears to have eaten them.

Row 2 follows from it:

| State | Single renders | Row 2 |
|---|---|---|
| Neither populated | A (empty) | one chip: `Look ＋` |
| Look A only | A | one chip: `Look ＋` |
| Look B only | **B** | one chip: `Look ＋` |
| Both populated | A | two chips: `Look A ＋` live, `Look B ＋` dimmed |

Split is always two chips, both live, positioned left and right to match the
image halves.

**Widths.** Every chip is `flex-1`. When there is only one, an empty `flex-1`
spacer holds the other half of the row open, so the lone chip is laid out by
exactly the same rule as a paired one — same basis, same gap, same left edge.

Reserving the space rather than computing a width (`calc(50% - 0.25rem)`, half
the row less half its gap) is deliberate: the two cannot drift apart, and there
is no arithmetic to get wrong. Switching single ↔ split therefore moves nothing —
the chip on screen keeps its size and position, and the second one replaces the
spacer.

This supersedes the original `--control-w` / `--control-w-split` capping, which
assumed a centred Row 1. Row 1 became full-width `justify-between`, so a centred
chip would have sat misaligned under a left-aligned mode toggle. Both rows are
now full-width and share their outer edges. `--control-w` survives as the mode
toggle's max-width; `--control-w-split` is removed.

**The lone chip always reads `Look`, whichever look it targets.** A-only and
B-only are the same situation from the user's side — one look, one chip — and
must behave identically. The A/B identity is simply not surfaced in Single; it
exists only in Split, where both chips are labelled and both halves are visible.

The B-only user does meet their products on the *right* half when they enter
Split, but the entry highlight lands on the `Look B` chip at exactly that moment
and explains it — which is what the highlight is for. No label asymmetry needed.

### Split → Single with both looks populated

Look A is rendered. Look B keeps its products in state and returns intact on
toggling back to Split.

Single shows **both** chips: Look A live, Look B dimmed with an inert `＋`, and
its label opening the drawer **read-only** (the drawer already supports this via
its `readOnly` prop).

The reasoning: hiding B outright is confusing in exactly one moment — the user
edits Look B in Split, taps Single, and the face changes to a different look
while nothing on screen accounts for what they were just working on. Showing B
dimmed says "this look exists, it is not available in this mode," which is the
same sentence Row 1's disabled treatment says about swap. Look A is both the
undimmed chip and the one on the face, so "which am I looking at" answers itself
with no caption. Read-only viewing means the user can check B's contents without
leaving Single; the inert `＋` prevents adding to an invisible look, which would
be exactly the silent reassignment this design rules out.

When only one look is populated there is no second chip to dim, and Single shows
the clean single centred chip.

### Swap

In Split, swapping exchanges the chip **contents**, so position always describes
its corresponding image half. `⇄` is disabled in Single; the route to Look B is
switching to Split, not swapping.

## A/B pills replace the caption

The `*Left = Look A · Right = Look B` caption is removed. In its place, small
semi-transparent `A` / `B` pills in the **bottom** corners of each image half —
they move with the swap, so the answer is always on the thing the user is
looking at.

Bottom corners rather than top: the top corners already hold the photo's
remove-`✕` (top-right) and the Before/After overlay's labels (both corners).

Split mode only. A shared overlay component (`LookPills`), so Model, Photo and
Camera all get it. Styling matches the existing overlay pills: `bg-ink/55
text-surface backdrop-blur-sm`, `rounded-pill`, 10px semibold uppercase.

**Labels come from the same expression that assigns the layers.** `RenderLooks`'
split variant carries `leftLook` / `rightLook` alongside `left` / `right`, and
`TryOnView` fills all four from one pair of `swapped ? … : …` values. The
renderer ignores the look ids; they exist so a pill cannot disagree with the
half it sits on, which is precisely how the old caption failed.

Note for anyone touching the camera path: its video and canvases are displayed
`scaleX(-1)`, and it already compensates by drawing `left` into the *right*-half
mask. So `left` means the viewer's left in all three sources, and the pills —
which are not mirrored — need no special case.

The `Editing Look A` hint in single view is removed along with the caption — the
dimmed/live chip distinction now carries that information.

## Clearing moves into the drawer

`Clear Look` leaves the dock entirely. The drawer already knows which slot it is
editing, which resolves the "clear which look?" ambiguity in Split. It also
resolves the glyph collision: the photo's `✕` becomes the only `✕` on the main
screen, so nothing reads as "delete photo" by mistake.

- **Per-product removal already exists** — `LayerRow` renders a per-layer `✕`
  and the drawer's `view` mode renders `LayerPanel`. No work needed.
- **New: a `Browse products` button** in the `view` mode empty state, under the
  "No products applied yet" blurb. Opening an empty look otherwise dead-ends:
  the only way on was to close the sheet and find the chip's `＋`. This is that
  same action, offered where the user already is. It flips the open drawer from
  `view` to `add` for the same look — so `ProductDrawer` is keyed on the look
  alone, not on `look:mode`, or the switch would remount and replay `slideUp` as
  though a second sheet had opened. Suppressed when `readOnly`.
- **New: a `Clear all` text button**, top-left of the drawer's `view` mode,
  above the list. It takes the left of the row that currently holds the
  `Look A` / `Active Layers` section label, and that label moves right on the
  same row — so it costs no extra chrome height, which matters because
  `drawerGeometry.CHROME_HEIGHT` budgets that space to guarantee four visible
  product rows.
- `Clear all` renders only in `view` mode, only when the look is non-empty, and
  never when `readOnly`.

## Save

`Save Look` leaves the dock and becomes Row 1's `♡`, disabled until `hasAny`.
This is a rewiring of the existing trigger, not a behavior change: `♡` opens the
existing `SaveLookSheet` with its current props, including the A / B / Both
branch when both looks have products.

## Mode-switch state migration

Switching modes never destroys or silently reassigns products. No confirmation
prompt in either direction.

- **Single → Split:** products already live in their look, so nothing moves.
  Two outcomes, treated differently:
  - **Exactly one look populated** — that look's half of the face gets makeup and
    the other half is bare. The chip holding the products (`primaryLook`, so
    `Look B` in the B-only case) gets a brief (~1.2s) highlight, so the
    assignment is visible rather than silent. This is the case item 8 was
    written for: it answers "why is only half my face made up, and which look
    owns it."
  - **Both populated** — the user built a Look B earlier and saw it dimmed in
    Single. Both halves come up with makeup at once. Nothing was assigned; both
    looks already existed and are simply both visible now, with both chips live.
    **No highlight** — highlighting a chip here would falsely imply something
    just moved.
- **Split → Single:** render `primaryLook`, keep the other look in state;
  `swapped` resets to false.

## Empty photo state

Falls out of the layout work rather than needing its own. The stage holds its
locked height with no photo, and `PhotoPrompt` already renders into the same
aspect-locked box as `PhotoPreview`, sized from the same measured height. The
dock stays visible with its Row 1 buttons in the disabled state, because the
dock no longer depends on `hasLayers`. Layout is identical before and after
upload; nothing shifts when a photo loads.

## Files

| File | Change |
|---|---|
| `src/components/tryon/TryOnDock.tsx` | **new** — Rows 1 and 2 |
| `src/components/tryon/LookPills.tsx` | **new** — A/B overlay |
| `src/lib/tryon/dockState.ts` | **new** — pure enablement + slot-label logic |
| `src/components/tryon/SplitControls.tsx` | **deleted** — replaced by `TryOnDock` |
| `src/components/tryon/LookBar.tsx` | **deleted** — replaced by `TryOnDock` Row 2 |
| `src/components/tryon/TryOnView.tsx` | shell restructure, dock wiring, migration highlight |
| `src/components/tryon/ProductDrawer.tsx` | `Clear all` |
| `src/components/tryon/PhotoSource.tsx` | render `LookPills` |
| `src/components/tryon/CameraSource.tsx` | render `LookPills` |
| `src/components/tryon/FaceMeshTracker.tsx` | render `LookPills` |
| `src/app/globals.css` | `--dock-h`; retain `--control-w`, `--control-w-split` |

## Testing

The repo tests pure library logic with vitest and has no component-testing
setup. `dockState.ts` exists so the branching this design introduces is testable
under that convention:

- `primaryLook` across all four population states
- whether the Single → Split highlight fires, and on which chip
- enablement of each Row 1 control across `{single, split} × {A empty, B empty,
  both empty, both populated}`
- Row 2 shape selection (one chip vs two) and per-chip live/dimmed state
- chip label and side assignment under `swapped`

Verification per task: `npm run test`, `npm run typecheck`, `npm run lint`, plus
a browser check at phone width.

## Knock-on: "swap to edit" copy

Swap became a split-only action, so two hints that told the user to swap in
single view were left giving impossible instructions — the `md+` panel column's
`· swap to edit` and the drawer's read-only caption. Both now read
`· switch to Split to edit`, matching the wording already on the dimmed chip's
inert `＋`.

This is the one place the `md+` layout had to change. It is a copy fix forced by
a behaviour change, not a redesign of that layout.

## Task order

1. **Shell** — `--dock-h`, dock container with hairline top border, stage locked.
   No behavior change yet.
2. **Drawer `Clear all`** — so clearing has a home before the dock button is
   removed.
3. **Row 1** — four always-rendered controls, shared disabled treatment, `♡`
   wired to the save sheet; the old Clear/Save pill row and trailing icons
   deleted.
4. **Row 2** — look slots, caption removal, Single's two shapes.
5. **A/B pills** on the preview, bottom corners.
6. **Mode-switch highlight.**
7. **Final pass** — empty-state check, tests, typecheck, lint.

Tasks land one at a time, each reviewed before the next begins.
