import type { Point } from "@/lib/facemesh/polygon";

/**
 * Rasterize a feathered white polygon mask into `canvas`, reusing the same
 * canvas across calls. Resizing the canvas clears it; when the size is
 * unchanged we clear explicitly so a stale mask never bleeds through.
 */
export function drawMask(
  canvas: HTMLCanvasElement,
  polygon: Point[],
  width: number,
  height: number,
  featherPx: number
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for mask canvas");

  ctx.clearRect(0, 0, width, height);
  ctx.filter = `blur(${featherPx}px)`;
  ctx.beginPath();
  polygon.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();
}
