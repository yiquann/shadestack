# Hairline-Aware Foundation via Selfie Segmentation — Design

## Goal

Foundation's top edge currently comes from an extrapolated face-oval (MediaPipe's 468-point
mesh has no hairline landmarks — it tops out at landmark 10, mid-forehead), so it cannot match a
real hairline. Add on-device **selfie segmentation** to detect the face-skin/hair boundary and use
it to clip the foundation region, so foundation covers the forehead up to — but not past — the
user's actual hairline, adapting per face.

## Approach (decided)

Keep the extended face-oval foundation mask, but **intersect it with the segmenter's face-skin
region**. `FOREHEAD_LIFT` is raised so the oval always overshoots past the hairline; a
`destination-in` composite against the skin mask then clips the top edge down to the real hairline.
The oval keeps its clean feather and the eye/lip smoothing holes; clipping also trims stray
hair/ears/background at the outer edge.

On **camera**, segmentation runs **throttled (~every 4th frame), reusing the last skin mask**
between runs, to protect the 30fps target. On **photo**, it runs once. The **model (illustrated
SVG)** source does not segment — it keeps the plain extended oval.

## Model

MediaPipe `ImageSegmenter` (`@mediapipe/tasks-vision@0.10.35`, already a dependency), model
`selfie_multiclass_256x256`
(`https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`).
Six categories; **index 3 = face-skin** (index 1 = hair, unused here). Created with
`outputCategoryMask: true, outputConfidenceMasks: false`. IMAGE mode → `segment(image, cb)`;
VIDEO mode → `segmentForVideo(video, timestampMs, cb)`. The callback receives a result whose
`categoryMask` is an `MPMask`: `.getAsUint8Array()` returns per-pixel category indices at
`.width × .height`; the mask must be `.close()`d after reading. Reuses the same
`FilesetResolver.forVisionTasks` WASM fileset as the FaceLandmarker.

## Architecture

```
src/
  lib/
    segment/
      imageSegmenter.ts   # getImageSegmenter() cached IMAGE singleton (photo);
                          # createVideoSegmenter() VIDEO instance, caller-closed (camera) (new)
      skinMask.ts         # pure: (Uint8Array categories, w, h) -> skin mask <canvas> (new)
      skinMask.test.ts    # (new)
    webgl/
      maskTexture.ts      # drawMask() gains optional clipMask (destination-in) (modified)
      compositor.ts       # Layer gains optional clipMask; render() passes it to drawMask (modified)
      glLayers.ts         # buildGlLayers(..., clipMask?) attaches clipMask to foundation
                          # layers; FOREHEAD_LIFT raised (modified)
      glLayers.test.ts    # (modified)
  components/
    tryon/
      PhotoSource.tsx     # one-shot segment() on the uploaded image; pass skin mask (modified)
      CameraSource.tsx    # throttled segmentForVideo() in the loop; reuse mask; pass it (modified)
```

## Data flow

- **Skin mask build (`skinMask.ts`):** given the category `Uint8Array` + dims, write an
  `ImageData` where face-skin (category 3) → opaque white, everything else → transparent, into a
  reused offscreen canvas. Returned as a `CanvasImageSource` for the mask compositor to scale.
  Building happens only when a fresh segmentation arrives (throttled on camera, once for photo).
- **Clip application (`drawMask`):** after filling the (extended) foundation polygon and punching
  eye/lip holes, if a `clipMask` is provided, `ctx.globalCompositeOperation = "destination-in"`
  then `drawImage(clipMask, 0, 0, width, height)` scales the skin mask to the mask canvas and
  keeps only the intersection. Restore `source-over`.
- **Attach (`buildGlLayers`):** new optional `clipMask` param; when present it is set on the
  foundation smooth + tint layers only (`config.smooth === "coverage"`). Other categories ignore
  it. When absent (model mode, or before the first segmentation result), foundation falls back to
  the plain extended oval — no clipping.
- **Photo:** `PhotoSource` runs `segment()` once after the image loads, builds the skin mask,
  passes it down to the render path.
- **Camera:** `CameraSource`'s render loop runs `segmentForVideo()` on a fixed interval
  (`SEGMENT_INTERVAL ≈ 4` frames), keeps the last built skin mask in a loop-local variable, and
  passes it into `buildGlLayers` every frame (fresh or reused). The VIDEO segmenter is created
  when the loop starts and `.close()`d in the same teardown that disposes the renderer and
  landmarker (guarded by the existing `cancelled` flag).

## Coordinate alignment

Segmentation runs on the same non-mirrored video/image frame as landmark detection and rendering.
The skin mask is in that same pixel space; `drawImage` scales it to the render canvas (same aspect
ratio, capped resolution). The CSS `scaleX(-1)` mirror applies equally to `<video>` and `<canvas>`
at display time, so the clipped composite stays aligned.

## Error handling

- Segmenter load failure or a segmentation error must **not** break try-on: on failure, skip
  clipping (foundation falls back to the extended oval) and surface nothing worse than the current
  behavior. Camera/photo status UI is unchanged.
- `MPMask` is always `.close()`d, including on the error path, to avoid GPU leaks.
- The VIDEO segmenter, like the VIDEO landmarker, is closed on every teardown path (unmount,
  status change, cancel-before-resolve).

## Testing & verification

- **Unit (pure):** `skinMask.ts` — given a small hand-built category array, the output canvas has
  opaque pixels exactly where category === 3 and transparent elsewhere; dimensions match.
- **Unit:** `glLayers` — `clipMask` is attached to foundation smooth+tint layers when passed, and
  never to blush/bronzer/others; absent param leaves foundation unclipped.
- **Not unit-tested:** the segmenter model, GPU inference, and the 2D `destination-in` clip —
  browser-only, covered by the controller/user live pass.
- **Verification (live):** photo + camera show foundation stopping at the real hairline; FPS badge
  stays at target on camera with segmentation throttled; a segmenter failure falls back cleanly;
  no camera-track or GPU-mask leaks across mode switches.

## Success criteria

1. Foundation coverage follows the user's actual hairline (photo and camera), not a fixed guess.
2. Camera sustains the 30fps target with segmentation throttled + mask reuse.
3. Eyes/lips still excluded from smoothing; oval feather preserved.
4. Model (SVG) mode unchanged. Segmenter failure degrades to the extended-oval fallback.
5. No `any` in the render pipeline; segmentation isolated under `lib/segment`; no leaked MPMask,
   camera track, or GPU resource.

## Out of scope

Using the hair/clothes/other categories for any effect; segmenting the illustrated model; a
background-replacement or blur-background feature.
