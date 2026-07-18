import type { Point } from "./polygon";

// Landmarks along the face's sagittal midline, forehead → chin (MediaPipe
// FaceMesh). Using many points and fitting a line through them (below) is far
// more stable than a 2-point forehead→chin line, which jitters frame-to-frame
// and drifts off-centre when either endpoint is noisy.
const MIDLINE_INDICES = [
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18,
  200, 199, 175, 152,
];

export function midlineEndpoints(
  points: Point[],
  width: number,
  height: number
): { top: Point; bottom: Point } {
  // Total-least-squares fit: the principal axis of the midline landmark cloud.
  let mx = 0;
  let my = 0;
  for (const i of MIDLINE_INDICES) {
    mx += points[i].x * width;
    my += points[i].y * height;
  }
  mx /= MIDLINE_INDICES.length;
  my /= MIDLINE_INDICES.length;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const i of MIDLINE_INDICES) {
    const dx = points[i].x * width - mx;
    const dy = points[i].y * height - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  // Angle of the principal (largest-variance) eigenvector of the covariance
  // matrix [[sxx,sxy],[sxy,syy]] — the best-fit line direction.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dx = Math.cos(theta);
  let dy = Math.sin(theta);
  // Orient toward the chin (increasing y = downward).
  if (dy < 0) {
    dx = -dx;
    dy = -dy;
  }

  // Two points on the fitted line through the centroid; callers extend it to
  // the canvas edges (`fullSpanMidline`) or far along it (`buildHalfMask`).
  return {
    top: { x: mx - dx * height, y: my - dy * height },
    bottom: { x: mx + dx * height, y: my + dy * height },
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
