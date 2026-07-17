# Phase 3: FaceLandmarker Integration + Model Face Fallback — Design

CLAUDE.md is the primary spec. This document covers decisions CLAUDE.md leaves open,
needed to build Phase 3 of its roadmap: "FaceLandmarker integration + illustrated Model
face fallback."

## Context

- Phase 1 (scaffold) and Phase 2 (catalog + Discover tab) are complete and pushed.
- No AR rendering (WebGL zones) exists yet — that's Phase 4. No live camera or photo
  upload exists yet — that's Phase 6.
- CLAUDE.md specifies MediaPipe Face Mesh via `@mediapipe/tasks-vision`'s
  `FaceLandmarker`, 468 landmarks, client-side WASM/WebGL delegate, singleton instance
  disposed on unmount, `lib/facemesh/` for landmark utils and zone definitions.

## Decisions

1. **Model/WASM hosting**: load both the WASM runtime and the `face_landmarker.task`
   model file from Google's public CDN (`storage.googleapis.com`) at runtime, matching
   MediaPipe's own reference usage. No files committed to the repo. (User-approved —
   simplest, zero bundle size, browser-cached after first load.)
2. **Phase 3 scope**: build the Model | Photo | Camera segmented picker on the Try On
   tab, but only "Model" is interactive — Photo and Camera render visually as disabled
   options. Model mode runs a real `FaceLandmarker.detect()` pass against a bundled
   illustrated face image and visually proves detection works (landmark dots overlaid on
   the image). Photo becomes real in Phase 6 (uses the same single-image `detect()` path
   this phase builds); Camera becomes real in Phase 6 (uses `detectForVideo()`, out of
   scope here). (User-approved.)
3. **Model face asset**: an original, hand-built SVG illustration
   (`public/model-face.svg`) with realistic (not cartoon-stylized) facial proportions —
   correct relative eye/nose/mouth placement — since MediaPipe's underlying face
   detector needs plausible facial geometry to detect landmarks at all. No third-party
   image, no licensing question. (User-approved.) **Risk, called out explicitly**: hand-
   drawn SVG proportions might not be detected as reliably as a photo-realistic image.
   This gets verified directly (Testing section) rather than assumed to work — if
   detection fails, the fallback is to iterate on the SVG's proportions/contrast until it
   does, not to silently ship a broken demo.
4. **Singleton lifecycle**: `getFaceLandmarker()` in `src/lib/facemesh/faceLandmarker.ts`
   is a module-level lazy singleton — created once on first call, cached for the app's
   session (model load takes ~1-2s; recreating it on every Try On tab visit would be
   wasteful and defeats the point of a singleton). CLAUDE.md's "dispose on unmount"
   applies at the consuming component's level: cancel in-flight detection calls and any
   animation frames on unmount, but do not destroy the shared `FaceLandmarker` instance
   itself. Later phases (Photo, Camera) reuse the same singleton.
5. **Detection mode for Model face**: `runningMode: "IMAGE"`, single `detect()` call on
   load — not `detectForVideo()` (that's Camera mode's job in Phase 6). This matches
   CLAUDE.md's Photo mode description ("single landmark pass, cached masks") — Model
   mode is architecturally identical to Photo mode, just with a bundled image instead of
   a user upload, which is why Phase 6's Photo mode can reuse this phase's detection
   path directly.
6. **Test scope**: `FaceLandmarker` requires a real browser WASM/WebGL environment and
   cannot run inside vitest. No unit tests for detection itself. Verified via a Playwright
   browser pass (same pattern used to close Phase 2's interactive-testing gap) — screenshot
   showing visible landmark dots on the model face, zero console errors, and an explicit
   check that `detect()` returns a non-empty face list (not just that the page renders).

## Architecture

```
src/lib/facemesh/
  faceLandmarker.ts    getFaceLandmarker(): Promise<FaceLandmarker> — module singleton

src/components/tryon/
  ModeSourcePicker.tsx  Model | Photo | Camera segmented control; only "model" active
  FaceMeshTracker.tsx   runs detect() against an image element, returns landmarks + status
  LandmarkDebugOverlay.tsx  canvas overlay drawing a pulsing dot per landmark

src/app/(tabs)/try-on/page.tsx   composes ModeSourcePicker + the model face + tracker + overlay

public/model-face.svg   hand-built illustrated face asset
```

## Data flow

1. Try On page mounts → `ModeSourcePicker` defaults to "model" (only enabled option).
2. `FaceMeshTracker` renders an `<img src="/model-face.svg">`, awaits
   `getFaceLandmarker()`, then on image load calls `detect(imageElement)` once.
3. Detected landmarks (or a "no face detected" error state) are passed up; loading state
   shown while the model downloads/initializes.
4. `LandmarkDebugOverlay` draws a `<canvas>` sized to the image, plotting a small pulsing
   dot per landmark point (reuses CLAUDE.md's existing `pulse 1.5s` animation, already
   defined for the camera overlay's landmark dots).

## Error handling

- WASM/model fetch failure (network issue) → inline error message, not a silent blank
  screen.
- `detect()` returns zero faces → inline "No face detected" message — this is the
  explicit signal that the hand-built SVG needs iteration, not something to swallow.
- Component unmount mid-detection → in-flight promise result is discarded (a `cancelled`
  flag, same pattern already used in `SimilarCarousel`), the shared model instance is
  left alone.

## Testing

Playwright browser pass against the live dev server: navigate to `/try-on`, wait for the
model face image and landmark overlay, screenshot, assert zero console errors, and assert
the overlay actually contains a plausible number of rendered landmark points (not just
that the canvas element exists) — this is the concrete check that closes the "does
detection actually work on our hand-built SVG" risk from decision 3.
