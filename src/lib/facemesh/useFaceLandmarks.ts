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
        const result = landmarker.detect(img);
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
