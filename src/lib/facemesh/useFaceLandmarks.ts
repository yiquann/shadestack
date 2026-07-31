"use client";

import { useEffect, useState, type RefObject } from "react";
import { getFaceLandmarker } from "./faceLandmarker";
import { rasterSize } from "./rasterSize";

// Detection landmarks come back normalized (0..1), so the raster's absolute size
// only affects cost, never the result. Uncapped it was the image's natural size:
// harmless for the 500x600 model SVG, but a 12MP phone selfie (4032x3024) meant
// a ~48MB canvas allocated alongside the already-decoded <img>, MediaPipe's own
// copy and two WebGL contexts. On iOS that spike is enough to get the tab
// discarded and reloaded, which silently reset the source back to Model.
// 1080 keeps far more detail than the face mesh can use while cutting the
// allocation by an order of magnitude.
const MAX_RASTER_EDGE = 1080;

export type FaceLandmarksState =
  | { status: "loading" }
  | { status: "detected"; points: { x: number; y: number }[] }
  | { status: "no-face" }
  | { status: "error"; message: string };

export function useFaceLandmarks(
  imageRef: RefObject<HTMLImageElement | null>,
  imageLoaded: boolean
): FaceLandmarksState {
  const [state, setState] = useState<FaceLandmarksState>({ status: "loading" });

  useEffect(() => {
    if (!imageLoaded) return;
    let cancelled = false;

    async function run() {
      try {
        const landmarker = await getFaceLandmarker();
        const img = imageRef.current;
        if (!img || cancelled) return;
        // Rasterize the SVG to an explicitly-sized canvas before detection.
        // Passing the <img> straight to detect() let the browser rasterize the
        // SVG at the element's (small) CSS display size, anchored top-left inside
        // the natural 500x600 frame — so MediaPipe saw a shrunken upper-left face
        // and returned landmarks scaled toward the origin, dragging the whole
        // makeup composite up and to the left. A canvas has unambiguous pixel
        // dimensions, so the full face fills the frame at its true scale.
        const raster = document.createElement("canvas");
        const { width: rw, height: rh } = rasterSize(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          MAX_RASTER_EDGE
        );
        raster.width = rw;
        raster.height = rh;
        const rctx = raster.getContext("2d");
        if (!rctx) {
          setState({ status: "error", message: "Could not rasterize model image" });
          return;
        }
        rctx.drawImage(img, 0, 0, raster.width, raster.height);
        const result = landmarker.detect(raster);
        if (cancelled) return;
        const face = result.faceLandmarks[0];
        if (!face || face.length === 0) {
          setState({ status: "no-face" });
          return;
        }
        setState({ status: "detected", points: face.map((p) => ({ x: p.x, y: p.y })) });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Detection failed",
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [imageRef, imageLoaded]);

  return state;
}
