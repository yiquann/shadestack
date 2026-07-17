"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas } from "./RenderCanvas";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 600;

export function FaceMeshTracker() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const state = useFaceLandmarks(imageRef, imageLoaded);

  // The <img src> is present in the server-rendered HTML, so the browser can
  // start (and finish) loading it before React hydrates and attaches the
  // onLoad listener below — the native "load" event fires once and is missed
  // in that race. Catch the already-complete case on mount as a fallback.
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setImageLoaded(true);
      setImageEl(imageRef.current);
    }
  }, []);

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card"
        style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src="/model-face.svg"
          alt="Illustrated model face"
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          onLoad={(e) => {
            setImageLoaded(true);
            setImageEl(e.currentTarget);
          }}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && imageEl && (
          <RenderCanvas
            image={imageEl}
            points={state.points}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
          />
        )}
      </div>
      {state.status === "loading" && (
        <p className="mt-2 text-center text-xs text-textMuted">Loading face tracking…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 text-center text-xs text-textMuted">No face detected.</p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Face tracking error: {state.message}
        </p>
      )}
    </div>
  );
}
