import type { Point } from "@/lib/facemesh/polygon";
import { featherCanvas } from "./canvasBlur";

// Masks are a smooth, low-frequency coverage field (their edges are
// deliberately feathered), so they carry no fine detail worth rasterizing at
// full canvas resolution. Rendering + blurring them at a reduced resolution and
// letting the compositor's LINEAR mask sampling upscale them cuts the CSS
// blur() cost dramatically — blur cost scales with (pixels × radius), and this
// shrinks both. The long edge is capped here; the polygon, holes, feather and
// clip images are all scaled to match, so the result is identical apart from
// the (invisible, because feathered) loss of high-frequency mask detail.
const MASK_MAX_EDGE = 256;

function tracePath(ctx: CanvasRenderingContext2D, polygon: Point[], scale: number): void {
  ctx.beginPath();
  polygon.forEach((p, i) => {
    const x = p.x * scale;
    const y = p.y * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * Rasterize a feathered white polygon mask into `canvas`, reusing the same
 * canvas across calls. The mask is drawn at a reduced resolution (see
 * MASK_MAX_EDGE) — `width`/`height` are the target canvas size the mask maps
 * onto, and everything (polygon, holes, feather, clips) is scaled down to the
 * reduced mask size. The compositor samples it with normalized texcoords and
 * LINEAR filtering, so the smaller mask upscales smoothly. Resizing the canvas
 * clears it; when the size is unchanged we clear explicitly so a stale mask
 * never bleeds through.
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
  // Downscale factor: the mask is rendered at this fraction of the target size.
  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(width, height));
  const maskW = Math.max(1, Math.round(width * scale));
  const maskH = Math.max(1, Math.round(height * scale));
  const scaledFeather = featherPx * scale;

  if (canvas.width !== maskW) canvas.width = maskW;
  if (canvas.height !== maskH) canvas.height = maskH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for mask canvas");

  ctx.clearRect(0, 0, maskW, maskH);
  ctx.fillStyle = "white";
  tracePath(ctx, polygon, scale);
  ctx.fill();

  if (holes && holes.length > 0) {
    ctx.globalCompositeOperation = "destination-out";
    for (const hole of holes) {
      tracePath(ctx, hole, scale);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Intersect with the skin mask (scaled to this canvas). Keeps only where both
  // the polygon mask and the skin mask are set, snapping the top edge to the
  // hairline.
  if (clipMask) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(clipMask, 0, 0, maskW, maskH);
    ctx.globalCompositeOperation = "source-over";
  }

  // Intersect with the region clip (scaled to this canvas). Keeps only where
  // the mask is set within the region, composing with the skin clip for final
  // masking.
  if (regionClip) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(regionClip, 0, 0, maskW, maskH);
    ctx.globalCompositeOperation = "source-over";
  }

  // Feather last, over the fully composed shape — (polygon − holes) ∩ skin ∩
  // region — so every edge it introduced is softened by one pass. Previously
  // each step was drawn under a live `ctx.filter`, which compounded the blur at
  // each intersection and, on WebKit (no ctx.filter), feathered nothing at all.
  featherCanvas(canvas, ctx, scaledFeather, maskW, maskH);
}
