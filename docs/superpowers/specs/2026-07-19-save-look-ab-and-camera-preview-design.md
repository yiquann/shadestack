# Save Look A/B/Both + Saved→Camera Preview — Design

## Goal

Two related changes to the saved-looks flow:

1. **Save Look popup** lets the user choose to save **Look A, Look B, or Both**,
   naming each look saved.
2. **Clicking a saved look** in the Saved tab opens Try On in **Camera** mode
   with the look applied, so the user sees it live on their own face.

## Current behavior

- `SaveLookSheet` takes a single name and `TryOnView` saves `looks[activeLook]`.
- Look B only holds layers in split view (or after the user populates it).
- `SavedView.applyLook`: `replaceLook("A", layers)` → `setMode("single")` →
  `router.push("/try-on")`. The **source** (Model/Photo/Camera) is local
  `useState` in `TryOnView` defaulting to `"model"`, so it lands on Model.
- The try-on session persists view `mode` to localStorage; saved looks/products
  persist via `SavedContext`.

## Part 1 — Save Look popup

`TryOnView` passes the sheet which looks have makeup (`hasA`, `hasB`, from
`looks.A.length > 0` / `looks.B.length > 0`) and the currently active look as the
default selection.

- **Only one look has makeup** (common single-view case): unchanged — one name
  field; saves that look.
- **Both looks have makeup**: show a **Look A / Look B / Both** segmented
  selector (default = active look).
  - A or B selected → one name field.
  - Both selected → two name fields ("Look A name", "Look B name"), producing
    **two** separate saved-look entries.
- Save is disabled until every visible name is non-empty (trimmed).

Interface: `onSave(choices: { look: LookId; name: string }[])`. `TryOnView`
maps each choice to the existing `saveLook(name, looks[look])` — so "Both" just
calls `saveLook` twice. No data-model change.

## Part 2 — Saved tab click → Camera preview

Lift the source into the session so the Saved tab can set it:

- Add in-memory (non-persisted) `source: SourceMode` + `setSource` to
  `TryOnSessionContext`. Not persisted, so a fresh page reload still defaults to
  Model (no surprise camera-permission prompt); navigating Saved→Try On carries
  the choice because the provider wraps the whole `(tabs)` layout.
- `TryOnView` reads `source`/`setSource` from the session instead of local
  `useState`.
- `SavedView.applyLook`: `replaceLook("A", layers)` → `setMode("single")` →
  `setSource("camera")` → `router.push("/try-on")`.
- If camera permission is denied, the existing `CameraSource` denied/error
  message shows; the look is still applied.

## Small refactor

Move the `SourceMode` type from `ModeSourcePicker.tsx` to
`src/lib/tryon/session.ts` so the session context owns it without a
lib→component import; `ModeSourcePicker` imports it from there.

## Files touched

- `src/lib/tryon/session.ts` — export `SourceMode`.
- `src/components/tryon/ModeSourcePicker.tsx` — import `SourceMode` from session.
- `src/lib/tryon/TryOnSessionContext.tsx` — add `source`/`setSource`.
- `src/components/tryon/TryOnView.tsx` — use session source; new save wiring.
- `src/components/tryon/SaveLookSheet.tsx` — A/B/Both selector + name field(s).
- `src/components/saved/SavedView.tsx` — set source to camera on apply.

## Testing

- Extend `SaveLookSheet` with a small pure helper for "which looks to save + are
  names valid" if it clarifies the branching; otherwise cover via the existing
  patterns. `savedCollection` logic is unchanged (already tested).
- Manual: single-look save (unchanged), both-look save (two entries), saved
  click lands on Camera with the look applied.
