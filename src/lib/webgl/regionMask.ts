import type { Point } from "@/lib/facemesh/polygon";
import { featherCanvas } from "./canvasBlur";

const HALF_MASK_FEATHER_PX = 2;

/** Signed side of point p relative to the directed line a->b (2D cross product). */
export function sideOfLine(p: Point, a: Point, b: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/**
 * Fill `canvas` white on `side` of the line through a->b (the tilting midline),
 * feathered. The line is extended across the canvas and the correct corner
 * polygon is filled. Reused across frames.
 */
export function buildHalfMask(
  canvas: HTMLCanvasElement,
  a: Point,
  b: Point,
  side: "left" | "right",
  width: number,
  height: number
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for half mask");
  ctx.clearRect(0, 0, width, height);

  // Direction of the midline; extend far beyond the canvas so the split line
  // always spans it. Build a quad covering the chosen side by offsetting the
  // extended line perpendicular toward that side.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len; // along the line
  const far = (width + height) * 2;
  const p0 = { x: a.x - ux * far, y: a.y - uy * far };
  const p1 = { x: b.x + ux * far, y: b.y + uy * far };
  // Perpendicular pointing to the requested side (screen "left" = smaller x).
  let nx = -uy;
  let ny = ux;
  const test = {
    x: (a.x + b.x) / 2 + nx,
    y: (a.y + b.y) / 2 + ny,
  };
  const onLeft = sideOfLine(test, a, b) > 0 === (side === "left");
  if (!onLeft) {
    nx = -nx;
    ny = -ny;
  }
  const off = far;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p1.x + nx * off, p1.y + ny * off);
  ctx.lineTo(p0.x + nx * off, p0.y + ny * off);
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();
  // Soften the split seam. Applied after the fill (not via `ctx.filter` during
  // it) so it also works on WebKit, which does not implement ctx.filter.
  featherCanvas(canvas, ctx, HALF_MASK_FEATHER_PX, width, height);
}
