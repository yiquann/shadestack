"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { fitWidth, useFitHeight } from "@/lib/tryon/useFitHeight";
import { RenderCanvas, type RenderLooks } from "./RenderCanvas";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 600;

type Props = {
  looks: RenderLooks;
};

export function FaceMeshTracker({ looks }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const availableHeight = useFitHeight(fitRef);
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
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      {/* Centred: the box is aspect-locked, so when the column's width is the
          binding constraint the leftover height is split above and below rather
          than all pooling underneath. */}
      <div ref={fitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          // bg-bg matches both the model SVG's backdrop and the page behind it.
          // The box height is fractional (aspect-ratio off a fractional width),
          // so the browser antialiases its top and bottom edge rows against
          // whatever sits behind; with the container left transparent that blend
          // showed as a hairline. Same colour on all three layers means there is
          // no edge contrast left to resolve. Photo/Camera use bg-ink instead,
          // matching their dark camera backdrop.
          className="relative mx-auto overflow-hidden rounded-card bg-bg"
          // Width derives from the measured free height, so the box always keeps
          // the 5:6 ratio the RenderCanvas overlay assumes.
          style={{
            aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}`,
            width: fitWidth(availableHeight, IMAGE_WIDTH, IMAGE_HEIGHT),
          }}
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
              looks={looks}
            />
          )}
        </div>
      </div>
      {state.status === "loading" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">Loading face tracking…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">No face detected.</p>
      )}
      {state.status === "error" && (
        <p className="mt-2 shrink-0 text-center text-xs text-textMuted">
          Face tracking error: {state.message}
        </p>
      )}
    </div>
  );
}
