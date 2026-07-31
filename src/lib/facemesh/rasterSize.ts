/**
 * Size for the offscreen canvas a still image is rasterized into before
 * landmark detection: the source dimensions, scaled down so the long edge is at
 * most `maxEdge`, with the aspect ratio preserved. Never upscales — a source
 * already within the cap (e.g. the 500x600 model SVG) is returned untouched, so
 * it keeps rasterizing at its natural size.
 */
export function rasterSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (!Number.isFinite(longEdge) || longEdge <= 0) return { width: 1, height: 1 };
  const scale = Math.min(1, maxEdge / longEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
