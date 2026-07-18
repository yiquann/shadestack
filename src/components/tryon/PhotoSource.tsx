"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas } from "./RenderCanvas";
import { getImageSegmenter } from "@/lib/segment/imageSegmenter";
import { buildSkinMask } from "@/lib/segment/skinMask";
import type { AppliedLayer } from "@/lib/tryon/session";

const MAX_WIDTH = 900;
const MAX_HEIGHT = 1080;

type Props = {
  layers: AppliedLayer[];
};

export function PhotoSource({ layers }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  // The single owner of revocation: cleanup runs with the previous url on
  // change (revoking the replaced photo) and with the current url on unmount.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create the URL in the handler (runs once), not in a setState updater
    // (which React invokes twice under Strict Mode, leaking the extra URL).
    setUrl(URL.createObjectURL(file));
  }

  return (
    <div>
      {url ? (
        // Keyed by url so a new photo remounts the detection hook fresh,
        // rather than showing the previous photo's stale landmark result.
        <PhotoPreview key={url} url={url} layers={layers} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-10 text-center">
          <p className="max-w-xs text-xs text-textMuted">
            Use a well-lit selfie with no makeup for the most accurate try-on results.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-pill bg-accent px-5 py-2 text-xs font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover"
          >
            Upload a photo
          </button>
        </div>
      )}

      {url && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
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

function PhotoPreview({ url, layers }: { url: string; layers: AppliedLayer[] }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ width: MAX_WIDTH, height: MAX_HEIGHT });
  const state = useFaceLandmarks(imageRef, imageLoaded);
  const [skinMask, setSkinMask] = useState<HTMLCanvasElement | null>(null);

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

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card"
        style={{ width: size.width, height: size.height, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={url}
          alt="Uploaded selfie"
          onLoad={onImageLoad}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && imageEl && (
          <RenderCanvas
            image={imageEl}
            points={state.points}
            width={size.width}
            height={size.height}
            layers={layers}
            clipMask={skinMask ?? undefined}
          />
        )}
      </div>
      {state.status === "loading" && (
        <p className="mt-2 text-center text-xs text-textMuted">Analyzing photo…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          No face detected — try a clearer, front-facing selfie.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Could not analyze photo: {state.message}
        </p>
      )}
    </div>
  );
}
