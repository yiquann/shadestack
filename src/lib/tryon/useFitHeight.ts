"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Observed pixel height of `ref`'s element, or null before first measurement.
 *
 * The try-on preview must keep its container's aspect ratio exactly equal to the
 * source's: the `<img>`/`<video>` uses object-cover, but the composited
 * RenderCanvas on top is stretched with plain `h-full w-full`, so any ratio
 * mismatch would slide the makeup off the face. The only safe way to fit the
 * preview is therefore to derive its *width* from the available height —
 * `width: min(100%, availableHeight * ratio)` — never to clamp width and let the
 * height fall out of step.
 *
 * That previously used a hardcoded `100dvh - 22rem` guess at the surrounding
 * chrome, which ran over on short viewports and pushed the controls below out of
 * the overflow-hidden frame and behind the tab bar. Measuring the container
 * removes the guess.
 *
 * No feedback loop: callers put this on a `flex-1 min-h-0` wrapper, whose height
 * comes from flex free space (basis 0), not from its child's content.
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setHeight(el.getBoundingClientRect().height);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

/**
 * CSS width for an aspect-locked preview that must fit inside `availableHeight`
 * without ever breaking its ratio. Falls back to the full column width until the
 * first measurement lands.
 */
export function fitWidth(
  availableHeight: number | null,
  ratioW: number,
  ratioH: number
): string {
  if (availableHeight === null || availableHeight <= 0 || ratioH <= 0) return "100%";
  return `min(100%, ${(availableHeight * ratioW) / ratioH}px)`;
}
