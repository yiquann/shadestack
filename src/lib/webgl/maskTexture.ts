import type { Point } from "@/lib/facemesh/polygon";

function tracePath(ctx: CanvasRenderingContext2D, polygon: Point[]): void {
  ctx.beginPath();
  polygon.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

/**
 * Rasterize a feathered white polygon mask into `canvas`, reusing the same
 * canvas across calls. Resizing the canvas clears it; when the size is
 * unchanged we clear explicitly so a stale mask never bleeds through.
 *
 * `holes` are punched out of the filled mask (destination-out) under the same
 * blur, so their edges are feathered too — used to keep facial features (eyes,
 * lips) out of the foundation skin-smoothing region.
 *
 * `clipMask`, if supplied, is intersected in afterward (destination-in) under
 * the same blur — used to snap a layer's mask to an externally-supplied skin
 * region (e.g. the real hairline) with a feathered edge instead of a hard cut.
 *
 * `regionClip`, if supplied, is intersected in after `clipMask` (destination-in)
 * under the same blur — used to further constrain a layer's mask to a region
 * (e.g. split-view left/right half), composing with the skin clip for final
 * masking: (polygon − holes) ∩ skin ∩ region.
 */
export function drawMask(
  canvas: HTMLCanvasElement,
  polygon: Point[],
  width: number,
  height: number,
  featherPx: number,
  holes?: Point[][],
  clipMask?: CanvasImageSource,
  regionClip?: CanvasImageSource
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for mask canvas");

  ctx.clearRect(0, 0, width, height);
  ctx.filter = `blur(${featherPx}px)`;
  ctx.fillStyle = "white";
  tracePath(ctx, polygon);
  ctx.fill();

  if (holes && holes.length > 0) {
    ctx.globalCompositeOperation = "destination-out";
    for (const hole of holes) {
      tracePath(ctx, hole);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Intersect with the skin mask (scaled to this canvas). Keeps only where both
  // the polygon mask and the skin mask are set, snapping the top edge to the
  // hairline. Blur stays on so the clipped edge is feathered, not hard.
  if (clipMask) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(clipMask, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }

  // Intersect with the region clip (scaled to this canvas). Keeps only where
  // the mask is set within the region, composing with the skin clip for final
  // masking. Blur stays on so the clipped edge is feathered, not hard.
  if (regionClip) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(regionClip, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }
}
