import type { Point } from "./polygon";

const FOREHEAD_CENTER = 10;
const CHIN = 152;

export function midlineEndpoints(
  points: Point[],
  width: number,
  height: number
): { top: Point; bottom: Point } {
  return {
    top: {
      x: points[FOREHEAD_CENTER].x * width,
      y: points[FOREHEAD_CENTER].y * height,
    },
    bottom: {
      x: points[CHIN].x * width,
      y: points[CHIN].y * height,
    },
  };
}

/**
 * Extend the line through a→b to the top (y=0) and bottom (y=height) canvas
 * edges, so the divider spans the whole frame rather than only forehead→chin.
 * Falls back to a vertical through a.x for a near-horizontal line (never happens
 * for a real face midline).
 */
export function fullSpanMidline(
  a: Point,
  b: Point,
  width: number,
  height: number
): { start: Point; end: Point } {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-6) {
    return { start: { x: a.x, y: 0 }, end: { x: a.x, y: height } };
  }
  const dx = b.x - a.x;
  const xAt = (y: number) => a.x + ((y - a.y) / dy) * dx;
  return { start: { x: xAt(0), y: 0 }, end: { x: xAt(height), y: height } };
}
