# Phase 4: WebGL Layer Renderer (6 Zones) — Design

CLAUDE.md is the primary spec (Rendering Fidelity Targets table, render pipeline
description, `lib/webgl` isolation convention). This document covers decisions CLAUDE.md
leaves open, needed to build Phase 4 of its roadmap: "WebGL layer renderer, one zone
(lips) end-to-end, then remaining five zones."

## Context

- Phase 3 shipped FaceLandmarker detection against a static illustrated Model face,
  producing 478 normalized (x,y in [0,1]) landmark points from a single `detect()` call.
- Phase 5 (Layer panel: toggle/opacity/drag-to-reorder) and Phase 6 (Photo/Camera modes,
  live video) do not exist yet. Phase 4 has no real product-selection UI to render real
  user choices.

## Decisions

1. **Phase 4 scope**: ship `lib/webgl` as an isolated, reusable rendering module, plus a
   non-interactive demo on the Try On page applying 2-3 hardcoded layers (pulled from
   real Phase 1 seed-catalog products, not arbitrary colors) on top of the Model face —
   proof that all 6 zones and both blend modes render correctly. Phase 5 replaces the
   hardcoded demo data with real product selection; the rendering engine itself doesn't
   change. (User-approved.)
2. **Mask feathering**: each zone's polygon (built from its landmark indices) is drawn to
   an offscreen 2D canvas, blurred via the canvas's native `filter: blur()`, then
   uploaded as a WebGL texture. This is far simpler than a multi-pass GPU Gaussian blur
   and is fast enough here since masks are computed once per `detect()` pass on a static
   image, not per video frame (Phase 6's live-camera 30fps target is a separate,
   later optimization concern — this phase explicitly does not need to hit it). (User-
   approved.)
3. **Blend mode mechanics**: WebGL's fixed-function blending has exact GPU-native
   equivalents of Photoshop-style multiply (`gl.blendFunc(DST_COLOR, ZERO)`) and screen
   (`gl.blendFunc(ONE, ONE_MINUS_SRC_COLOR)`). The fragment shader only needs to output
   `tintColor * maskAlpha * layerOpacity`; GL's blend state (set per draw call from
   CLAUDE.md's per-category blend mode) handles the actual compositing math. One shader
   program is reused for every layer/zone — only its uniforms (tint color, opacity, mask
   texture, blend mode via which `gl.blendFunc` is active for that draw call) change.
4. **Zone → landmark mapping**: MediaPipe's 468-point face mesh has well-documented
   canonical landmark index groups (lips outer/inner ring, eye contours, face oval,
   eyebrows, etc.) — the same groups MediaPipe's own reference tooling uses. These are
   encoded directly in `src/lib/facemesh/zones.ts` as index arrays; this is a factual
   mapping (which points trace which anatomical region), not a design choice with
   trade-offs to weigh.
5. **The "6 zones" vs. full-face products**: CLAUDE.md's Rendering Fidelity Targets table
   lists Foundation and Setting Powder as "full-face tint," distinct from the six
   zone-restricted categories (Blush→cheeks, Bronzer→temples+jawline,
   Highlighter→cheekbones+nose bridge, Eyeshadow→lids, Lipstick→lips). Foundation/Setting
   Powder use a 7th mask — the face-oval outline — rather than being restricted to one of
   the six named zones. This doesn't contradict CLAUDE.md's "six facial regions" framing;
   full-face products are the explicit exception it already describes.
6. **Test scope**: zone-polygon math (landmark indices → pixel-space polygon points) is
   pure and unit-testable with vitest. Actual WebGL rendering (shader compilation,
   texture upload, draw calls, canvas pixel output) cannot run in vitest — verified via
   the same Playwright pattern established in Phase 3 (screenshot showing visibly tinted
   zones on the Model face, zero console errors).

## Architecture

```
src/lib/facemesh/
  zones.ts              zone name -> landmark index array (6 zones + faceOval)
  zones.test.ts          shape/coverage checks on the index arrays themselves
  polygon.ts             landmarksToPolygon(landmarks, indices, width, height): {x,y}[]
  polygon.test.ts

src/lib/webgl/
  shaders.ts              vertex + fragment GLSL source strings
  maskTexture.ts           buildMaskTexture(gl, polygon, width, height, featherPx): WebGLTexture
  layerRenderer.ts         compositeLayer(gl, params): draws one layer's masked tint pass
  compositor.ts            orchestrates: clear -> draw base image -> draw N layers in order

src/components/tryon/
  RenderCanvas.tsx         owns the WebGL context, base image texture, draws demo layers
```

## Data flow

1. `FaceMeshTracker` (Phase 3) still owns detection; once `useFaceLandmarks` reaches
   `"detected"`, `RenderCanvas` receives the 478 points instead of (or alongside)
   `LandmarkDebugOverlay`.
2. For each demo layer (in bottom-to-top order: foundation → blush → lipstick, matching
   CLAUDE.md's default stacking), `RenderCanvas` calls `landmarksToPolygon` for that
   layer's zone, then `buildMaskTexture` (2D canvas draw + blur + upload), then
   `compositeLayer` (bind base image + mask textures, set blend mode/opacity/tint
   uniforms, draw a full-screen quad).
3. Output renders directly to a `<canvas>` sized to match the Model face image,
   positioned in the same place `LandmarkDebugOverlay` currently occupies.

## Error handling

- WebGL context creation failure (unsupported browser) → inline fallback message,
  don't crash the page.
- Shader compilation/link failure → thrown with the GL info log attached, caught at the
  top level and surfaced as an inline error (this should only ever fire during
  development if a shader has a syntax error, not in normal operation).

## Testing

- `zones.test.ts`: each of the 7 masks (6 zones + faceOval) has a non-empty index array,
  no zone references an out-of-range index (>477).
- `polygon.test.ts`: `landmarksToPolygon` correctly maps normalized [0,1] landmark
  coordinates to pixel-space coordinates for a given width/height; handles a
  minimal 3-point fixture.
- Playwright: navigate to `/try-on`, wait for the render canvas, screenshot, confirm
  visible color change in the lip/cheek regions versus the unmodified Model face
  (Phase 3's screenshot is the "before" baseline to compare against), zero console
  errors.
