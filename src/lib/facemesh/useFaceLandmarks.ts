"use client";

import { useEffect, useState, type RefObject } from "react";
import { getFaceLandmarker } from "./faceLandmarker";

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
        raster.width = img.naturalWidth || img.width;
        raster.height = img.naturalHeight || img.height;
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
