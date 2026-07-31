"use client";

import { useEffect, useState } from "react";
import type { ViewportMetrics } from "./drawerGeometry";

function readMetrics(): ViewportMetrics {
  const vv = window.visualViewport;
  return {
    innerHeight: window.innerHeight,
    viewportHeight: vv?.height ?? window.innerHeight,
    viewportOffsetTop: vv?.offsetTop ?? 0,
  };
}

/**
 * Tracks the visible viewport so a bottom sheet can sit above the on-screen
 * keyboard. Falls back to the layout viewport where `visualViewport` is
 * missing, which yields a plain bottom-anchored sheet.
 */
export function useVisualViewport(): ViewportMetrics {
  // Read lazily rather than in an effect so the drawer never paints a
  // zero-height frame. Safe because the drawer only ever mounts client-side,
  // in response to a tap.
  const [metrics, setMetrics] = useState<ViewportMetrics>(() =>
    typeof window === "undefined"
      ? { innerHeight: 0, viewportHeight: 0, viewportOffsetTop: 0 }
      : readMetrics()
  );

  useEffect(() => {
    const update = () => setMetrics(readMetrics());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return metrics;
}
