# Phase 6: Photo Mode + Live Camera Mode — Design

## Goal

Roadmap item 6 is "Photo mode, then live Camera mode (perf pass to hit 30fps)." Today the Try On
tab has a three-way source picker (**Model | Photo | Camera**), but only **Model** works — Photo
and Camera are disabled stubs, and `FaceMeshTracker` is hardwired to the illustrated
`/model-face.svg`. This phase makes all three sources real:

- **Photo:** the user uploads a selfie; the existing one-shot landmark + WebGL composite pipeline
  runs on it (same as Model, different image).
- **Camera:** a live front-facing camera feed is tracked per-frame (MediaPipe `VIDEO` running
  mode) and composited in real time at **30+ fps**, mirrored selfie-style, with a Flip control.

Reaching 30 fps requires reworking the renderer: today `renderComposite` builds a fresh WebGL
context, recompiles both shader programs, and rasterizes each layer's mask via a brand-new 2D
canvas **on every call**, then disposes it all. That is fine for one-shot Model/Photo and for
opacity-slider drags on a static image, but it recompiles shaders and reallocates textures dozens
of times per second under a live feed. The perf pass replaces it with a persistent per-canvas
renderer that owns its GL resources for its lifetime.

**Explicitly out of scope for this phase:** split-view Look A/B comparison (roadmap 7), shade
match (roadmap 8), and Saved looks/products (roadmap 9). No changes to the catalog, layer panel,
or session state beyond what source-switching requires.

## Architecture

```
src/
  lib/
    facemesh/
      faceLandmarker.ts        # add VIDEO-mode landmarker factory (modified)
      useFaceLandmarks.ts      # unchanged — reused by Photo (one-shot on an <img>)
      useVideoFaceLandmarks.ts # per-frame VIDEO detection loop hook (new)
      useCameraStream.ts       # getUserMedia + facingMode + flip + cleanup (new)
    webgl/
      compositor.ts            # add createCompositeRenderer(canvas); keep math (modified)
      maskTexture.ts           # add scratch-canvas-reusing variant (modified)
  components/
    tryon/
      ModeSourcePicker.tsx     # interactive: active + onChange, all three enabled (modified)
      TryOnView.tsx            # owns active-mode state, switches source component (modified)
      FaceMeshTracker.tsx      # Model source — RenderCanvas refactor only (modified)
      PhotoSource.tsx          # upload → one-shot landmarks → RenderCanvas (new)
      CameraSource.tsx         # video feed → per-frame landmarks → RenderCanvas (new)
      RenderCanvas.tsx         # holds a persistent renderer; accepts img OR video (modified)
```

## Component & data flow

### Mode state
`ModeSourcePicker` drops its `disabled`/`active="model"` hardcoding and takes
`active: SourceMode` + `onChange: (m: SourceMode) => void`, where
`SourceMode = "model" | "photo" | "camera"`. `TryOnView` owns the active mode in local React
state (default `"model"`), renders the picker, and switches between `FaceMeshTracker` (model),
`PhotoSource`, and `CameraSource`. The layer panel, Add Products section, and try-on session
context are shared across all three — only the face-source region swaps.

### FaceLandmarker lifecycle (two running modes)
MediaPipe's `FaceLandmarker` is created for one `runningMode`; switching it via `setOptions`
reloads the graph and is too slow to toggle interactively. So we keep two:

- **`getFaceLandmarker()`** (existing) — cached singleton, `runningMode: "IMAGE"`. Used by Model
  and Photo via `detect(img)`. Unchanged.
- **`createVideoFaceLandmarker()`** (new) — creates a `runningMode: "VIDEO"` instance. Created
  when `CameraSource` mounts, `.close()`d on unmount so its GPU resources are freed when the user
  leaves Camera. It is **not** a permanent singleton. The WASM fileset and the model `.task`
  asset are already fetched/cached by the image landmarker, so construction is fast.

Both share the same CDN wasm path and model asset path (factor the shared config into a helper so
the two factories don't drift).

### Photo mode (`PhotoSource`)
- A hidden `<input type="file" accept="image/*">` triggered by a token-styled upload button.
- Empty state before a photo is chosen: prompt copy from the prototype —
  *"Use a well-lit selfie with no makeup for the most accurate try-on results."*
- On pick: create an object URL, set it as the `<img src>`, wait for load, then reuse the
  **existing** `useFaceLandmarks` one-shot hook and `RenderCanvas` — identical to the Model path,
  only the image differs. Reuses the existing `loading` / `no-face` / `error` status UI.
- Revoke the previous object URL when a new photo replaces it and on unmount (no leaks).
- The uploaded image never leaves the device (privacy requirement); it is only drawn to a local
  canvas and read by the local landmarker.

### Camera mode (`CameraSource`)
- **`useCameraStream(facingMode)`** — calls `getUserMedia({ video: { facingMode } })`, returns the
  `MediaStream` (or a permission/`NotFound` error state) and a `flip()` that toggles
  `"user"` ↔ `"environment"`. Stops **all** tracks on unmount and on facing-mode change (no
  orphaned camera light). Attaches the stream to a `<video autoplay muted playsinline>`.
- Preview is mirrored selfie-style: CSS `transform: scaleX(-1)` applied to **both** the `<video>`
  and the overlaid `<canvas>` so the composite stays aligned with the mirrored feed. (Landmarks and
  masks are still computed in true, non-mirrored pixel space; only the final display is flipped.)
- **Flip button** re-requests the stream with the opposite `facingMode`.
- Permission-denied / no-camera states show a friendly message using existing muted-text styling.
- **`useVideoFaceLandmarks(videoRef, landmarker)`** — runs a per-frame loop with
  `requestVideoFrameCallback` where available, falling back to `requestAnimationFrame`. Each tick:
  read a monotonically increasing timestamp, call `detectForVideo(video, timestamp)`, and store the
  latest landmark points in a ref that drives `RenderCanvas`. Cancels the callback on unmount.
- **Graceful degradation:** track a rolling frame time. If it exceeds the 30 fps budget, throttle
  the *detection* cadence toward ~24 fps (skip landmark detection on some frames, keep drawing the
  last composite) **before** reducing resolution — matching CLAUDE.md's "degrade to 24fps before
  dropping resolution."

### Perf pass — persistent renderer (core change)
Add `createCompositeRenderer(canvas)` to `compositor.ts`, returning `{ render, dispose }`:

- **Construction (once per canvas):** get the WebGL context, set `UNPACK_FLIP_Y_WEBGL = false`,
  compile both shader programs, create the quad buffer, create one persistent image texture, and
  set up a reused scratch 2D canvas + a small pool of mask textures for mask rasterization.
- **`render(source: TexImageSource, layers: Layer[])`:** upload `source` into the persistent image
  texture (`texImage2D` each frame — cheap for video), then for each layer rasterize its feathered
  mask into the reused scratch canvas and upload it into a pooled mask texture, and draw with the
  existing premultiplied blend funcs. Grow the mask-texture pool only if a frame needs more masks
  than seen before; never recreate programs or the quad buffer.
- **`dispose()`:** delete all GL objects; called on `RenderCanvas` unmount.

`RenderCanvas` creates the renderer once (stored in a ref keyed to the canvas) and calls `render`:
static modes (Model/Photo) on `layers`/`points`/`source` change; Camera every frame via the video
loop. The stateless `renderComposite` export is removed once all call sites use the renderer.

**Preserved exactly:** the blend math (`TINT_FRAGMENT_SHADER` premultiplied output, the
`blendFuncSeparate` multiply/screen factors), `UNPACK_FLIP_Y_WEBGL = false`, and the
landmark→polygon→feathered-mask construction. Only resource *ownership and lifetime* change, not
what is drawn.

## Types

```ts
type SourceMode = "model" | "photo" | "camera";
type FacingMode = "user" | "environment";

type CompositeRenderer = {
  render(source: TexImageSource, layers: Layer[]): void;
  dispose(): void;
};
```

`Layer`, `Point`, `AppliedLayer`, and `hexToRgb01` are unchanged and reused.

## Error handling

- **Photo:** unreadable image / no face → existing `no-face` / `error` status messaging; upload
  button stays available to retry.
- **Camera permission denied / no device:** dedicated message ("Camera access is needed for live
  try-on" / "No camera found") with muted styling; the picker still allows switching back to Model
  or Photo.
- **WebGL unavailable:** `createCompositeRenderer` throws the existing "WebGL is not supported"
  error; surfaced as the source region's error state rather than crashing the tab.
- **Landmarker load failure:** existing `error` status path is reused for both one-shot and video
  hooks.

## Testing & verification

- **Unit tests (pure logic only):** the facing-mode flip (`user` ↔ `environment`) and the
  degrade-throttle decision (given frame times, whether to skip detection this frame). Mode
  switching is trivial state and covered by verification rather than a test.
- **Not unit-tested:** WebGL rendering, `getUserMedia`, and MediaPipe detection — these need a real
  browser/GPU/camera and are covered by manual verification.
- **Verification:**
  - Photo: run the dev server, upload a real selfie, confirm landmarks + composite render and the
    prompt/empty/no-face states behave.
  - Camera: open Camera mode in the browser, confirm the mirrored live feed composites layers in
    real time and Flip works.
  - Perf: a dev-only FPS readout confirms 30+ fps on the live feed; confirm the degrade path caps
    detection near 24 fps under load without dropping resolution.
  - Regression: Model mode still renders correctly after the renderer refactor.

## Success criteria

1. All three source modes selectable and functional from the Try On tab.
2. Photo mode composites a user-uploaded selfie through the existing pipeline; no image leaves the
   device.
3. Camera mode shows a mirrored live front-camera feed with real-time layer compositing and a Flip
   control; camera stops cleanly on leaving the mode.
4. Live feed sustains 30+ fps on mid-range hardware, degrading detection cadence toward 24 fps
   before touching resolution.
5. Model mode is unchanged in behavior after the renderer refactor.
6. No per-frame shader recompilation or GL-object churn under the live feed.
