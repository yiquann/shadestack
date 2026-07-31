/**
 * Feathering support for mask canvases, with a Safari fallback.
 *
 * The mask pipeline feathers every edge with `ctx.filter = "blur(Npx)"`.
 * WebKit does not implement `CanvasRenderingContext2D.filter` (it is absent
 * through iOS 17 and flag-disabled in 18+), and assigning an unimplemented
 * property on a platform object silently creates a same-valued expando — so it
 * neither throws nor reads back as "none". The result on iOS was a completely
 * unfeathered pipeline: tint masks became hard-edged landmark polygons ("harsh
 * lines", pigment sitting on top of the face rather than blending), and the
 * `smooth` mask became a solid alpha=1 face oval, applying the full-strength
 * skin blur uniformly across the whole region so the frame read as low-res.
 *
 * Fallback: canvas *shadows* are implemented everywhere and are a real Gaussian
 * blur. Drawing the mask fully off-canvas while offsetting its shadow back into
 * place yields the blurred silhouette alone — equivalent for a mask, whose
 * consumers only read the alpha channel.
 */

/** Per spec, a shadow's Gaussian has stdDev = shadowBlur/2, while
 *  `filter: blur(r)` has stdDev = r. Double the radius to match. */
export function shadowBlurForRadius(radius: number): number {
  return radius * 2;
}

/** How far to push the source off-canvas so only its shadow remains visible.
 *  Must clear the canvas plus the blur's own spread. */
export function shadowOffsetForRadius(width: number, radius: number): number {
  return width + radius * 4 + 1;
}

let supported: boolean | null = null;

/**
 * Whether `ctx.filter` actually filters. Checks the prototype (an expando on the
 * instance would pass a naive round-trip check) and then verifies functionally
 * by blurring a hard edge and confirming it bled into a neighbouring pixel.
 * Evaluated once and cached.
 */
export function canvasFilterSupported(): boolean {
  if (supported !== null) return supported;
  supported = detect();
  return supported;
}

function detect(): boolean {
  if (typeof document === "undefined") return false;
  const proto = globalThis.CanvasRenderingContext2D?.prototype;
  if (!proto || !("filter" in proto)) return false;
  try {
    const probe = document.createElement("canvas");
    probe.width = 8;
    probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.filter = "blur(2px)";
    ctx.fillStyle = "#fff";
    // Fill only the left half; with a working blur, alpha bleeds past x=4.
    ctx.fillRect(0, 0, 4, 1);
    return ctx.getImageData(5, 0, 1, 1).data[3] > 0;
  } catch {
    return false;
  }
}

/** Test seam: reset the cached detection result. */
export function resetCanvasFilterSupport(): void {
  supported = null;
}

let scratch: HTMLCanvasElement | null = null;

function getScratch(): HTMLCanvasElement {
  if (!scratch) scratch = document.createElement("canvas");
  return scratch;
}

/**
 * Gaussian-blur the already-composed contents of `canvas` in place by `radius`
 * pixels. `ctx` must be that canvas's 2D context; its filter/shadow/composite
 * state is saved and restored.
 */
export function featherCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  height: number
): void {
  if (radius <= 0 || width <= 0 || height <= 0) return;

  // Snapshot the sharp mask; a canvas cannot be blurred onto itself.
  const src = getScratch();
  if (src.width !== width) src.width = width;
  if (src.height !== height) src.height = height;
  const sctx = src.getContext("2d");
  if (!sctx) return;
  sctx.clearRect(0, 0, width, height);
  sctx.drawImage(canvas, 0, 0);

  ctx.save();
  // Explicit clear + source-over rather than the "copy" operator: `copy`
  // combined with a shadow has inconsistent cross-browser behaviour, and this
  // is the same result with no ambiguity.
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  if (canvasFilterSupported()) {
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(src, 0, 0);
  } else {
    // WebKit: the shadow *is* the blur. Draw the source beyond the left edge and
    // offset its shadow back over the canvas, so only the blurred silhouette lands.
    const offset = shadowOffsetForRadius(width, radius);
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = shadowBlurForRadius(radius);
    ctx.shadowOffsetX = offset;
    ctx.drawImage(src, -offset, 0);
  }
  ctx.restore();
}
