"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas, type RenderLooks } from "./RenderCanvas";
import { BeforeAfterOverlay } from "./BeforeAfterOverlay";
import { fitWidth, useFitHeight } from "@/lib/tryon/useFitHeight";
import { rasterSize } from "@/lib/facemesh/rasterSize";
import { getImageSegmenter } from "@/lib/segment/imageSegmenter";
import { buildSkinMask } from "@/lib/segment/skinMask";

const MAX_WIDTH = 900;
const MAX_HEIGHT = 1080;
// Matches CameraSource's preview box so the two modes occupy identical space.
const PREVIEW_RATIO_W = 3;
const PREVIEW_RATIO_H = 4;
// The photo is letterboxed into that fixed box. The <img> and the composited
// canvas must use the same value or they scale differently and the makeup
// drifts off the face.
const PREVIEW_FIT = "contain" as const;
// Long-edge cap applied to the picked file before it becomes an <img>. Matches
// the render cap — anything beyond it is memory the pipeline never uses.
const MAX_SOURCE_EDGE = 1080;
const PICK_FLAG = "shadestack.tryon.photoPickInFlight";

type Props = {
  looks: RenderLooks;
};

/**
 * Object URL for `file`, downscaled so its long edge is at most
 * MAX_SOURCE_EDGE. Falls back to the untouched file whenever the browser can't
 * do the conversion, so picking a photo never fails outright.
 */
async function boundedObjectUrl(file: File): Promise<string> {
  if (typeof createImageBitmap !== "function") return URL.createObjectURL(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Undecodable here (e.g. an exotic HEIC variant) — let <img> try instead.
    return URL.createObjectURL(file);
  }
  try {
    const { width, height } = rasterSize(bitmap.width, bitmap.height, MAX_SOURCE_EDGE);
    if (width >= bitmap.width && height >= bitmap.height) return URL.createObjectURL(file);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return URL.createObjectURL(file);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    return blob ? URL.createObjectURL(blob) : URL.createObjectURL(file);
  } finally {
    // Release the full-resolution decode immediately rather than waiting for GC.
    bitmap.close();
  }
}

export function PhotoSource({ looks }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  // True when the document was destroyed while the native picker was open —
  // see PICK_FLAG. Surfaces an explanation instead of an unexplained bounce
  // back to the upload prompt.
  const [reloadedDuringPick, setReloadedDuringPick] = useState(false);

  // The single owner of revocation: cleanup runs with the previous url on
  // change (revoking the replaced photo) and with the current url on unmount.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // A flag set before the picker opens survives in sessionStorage only if the
  // document was torn down and reloaded while the picker was up. Finding it on
  // mount is therefore positive evidence of an iOS tab discard, not a guess.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(PICK_FLAG)) {
        window.sessionStorage.removeItem(PICK_FLAG);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReloadedDuringPick(true);
      }
    } catch {
      // sessionStorage unavailable — skip the diagnostic.
    }
  }, []);

  function openPicker() {
    try {
      window.sessionStorage.setItem(PICK_FLAG, "1");
    } catch {
      // sessionStorage unavailable — the picker still opens.
    }
    inputRef.current?.click();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    try {
      window.sessionStorage.removeItem(PICK_FLAG);
    } catch {
      // ignore
    }
    if (!file) return;
    setReloadedDuringPick(false);
    // Downscale before the photo ever reaches an <img>. A 12MP phone selfie
    // decodes to ~48MB, which the browser then holds for the lifetime of the
    // element — alongside the segmenter, the landmarker and two WebGL contexts.
    // That is what pushes iOS over its per-tab budget and gets the page
    // discarded mid-pick. Capped, the same photo costs a few MB.
    // Create the URL outside a setState updater, which Strict Mode would run
    // twice and leak the extra URL.
    setUrl(await boundedObjectUrl(file));
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {url ? (
        // Keyed by url so a new photo remounts the detection hook fresh,
        // rather than showing the previous photo's stale landmark result.
        <PhotoPreview key={url} url={url} looks={looks} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-10 text-center">
          {reloadedDuringPick ? (
            <p className="max-w-xs text-xs text-textSecondary">
              Your browser reloaded this page while the photo picker was open, so the
              photo was lost. Picking a smaller photo usually avoids it.
            </p>
          ) : (
            <p className="max-w-xs text-xs text-textMuted">
              Use a well-lit selfie with no makeup for the most accurate try-on results.
            </p>
          )}
          <button
            type="button"
            onClick={openPicker}
            className="rounded-pill bg-accent px-5 py-2 text-xs font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover"
          >
            {reloadedDuringPick ? "Try again" : "Upload a photo"}
          </button>
        </div>
      )}

      {url && (
        <div className="mt-3 flex shrink-0 items-center justify-center gap-3">
          <button
            type="button"
            onClick={openPicker}
            className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          >
            Choose another photo
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}

function PhotoPreview({ url, looks }: { url: string; looks: RenderLooks }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ width: MAX_WIDTH, height: MAX_HEIGHT });
  const state = useFaceLandmarks(imageRef, imageLoaded);
  const [skinMask, setSkinMask] = useState<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const availableHeight = useFitHeight(fitRef);

  useEffect(() => {
    if (!imageLoaded || !imageEl) return;
    let cancelled = false;
    getImageSegmenter()
      .then((segmenter) => {
        if (cancelled) return;
        segmenter.segment(imageEl, (result) => {
          const mask = result.categoryMask;
          if (!mask) return;
          try {
            const canvas = document.createElement("canvas");
            buildSkinMask(canvas, mask.getAsUint8Array(), mask.width, mask.height);
            if (!cancelled) setSkinMask(canvas);
          } finally {
            mask.close();
          }
        });
      })
      .catch(() => {
        // Segmentation unavailable -> foundation falls back to the extended oval.
      });
    return () => {
      cancelled = true;
    };
  }, [imageLoaded, imageEl]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const scale = Math.min(MAX_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight, 1);
    setSize({
      width: Math.round(img.naturalWidth * scale),
      height: Math.round(img.naturalHeight * scale),
    });
    setImageLoaded(true);
    setImageEl(img);
  }

  // The "after" (made-up) layer. RenderCanvas composites the makeup onto the
  // same base image, so the underlying <img> is the "before".
  const afterLayer =
    state.status === "detected" && imageEl ? (
      <RenderCanvas
        image={imageEl}
        points={state.points}
        width={size.width}
        height={size.height}
        looks={looks}
        clipMask={skinMask ?? undefined}
        // The box is a fixed 3:4 but the canvas is the photo's own ratio, so it
        // must be letterboxed exactly like the <img> beneath it.
        objectFit={PREVIEW_FIT}
      />
    ) : null;
  // Before/after only applies to a single look with makeup applied; split view
  // uses its own Look A / Look B divider instead.
  const comparing = looks.mode === "single" && looks.compare && looks.layers.length > 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <div ref={fitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-card bg-ink"
          // Deliberately the camera's 3:4 box, not the photo's own ratio, so
          // switching Photo <-> Camera never changes the preview's footprint and
          // pushes the controls below it out of the frame. The photo is letterboxed
          // into it with object-contain (see PREVIEW_FIT) rather than cropped, so
          // a tall selfie never loses the top of the face; the dark bars match the
          // camera backdrop. Width comes from the measured free height.
          style={{
            aspectRatio: `${PREVIEW_RATIO_W} / ${PREVIEW_RATIO_H}`,
            width: fitWidth(availableHeight, PREVIEW_RATIO_W, PREVIEW_RATIO_H),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={url}
            alt="Uploaded selfie"
            onLoad={onImageLoad}
            style={{ objectFit: PREVIEW_FIT }}
            className="h-full w-full"
          />
          {afterLayer &&
            (comparing ? (
              <>
                {/* Reveal the "after" only to the right of the wipe line; the
                    original <img> shows through on the left. */}
                <div
                  className="absolute inset-0"
                  style={{ clipPath: "inset(0 0 0 var(--wipe, 50%))" }}
                >
                  {afterLayer}
                </div>
                <BeforeAfterOverlay targetRef={containerRef} />
              </>
            ) : (
              afterLayer
            ))}
        </div>
      </div>
      {state.status === "loading" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">Analyzing photo…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">
          No face detected — try a clearer, front-facing selfie.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">
          Could not analyze photo: {state.message}
        </p>
      )}
    </div>
  );
}
