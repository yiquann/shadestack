export const FACE_SKIN_CATEGORY = 3;

/**
 * RGBA pixels for a skin mask: white + opaque where the segmentation category
 * is face-skin, transparent elsewhere. Pure — no canvas, so it is testable.
 */
export function skinMaskData(
  categories: Uint8Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const buffer = new ArrayBuffer(width * height * 4);
  const out = new Uint8ClampedArray(buffer);
  for (let i = 0; i < width * height; i++) {
    const on = categories[i] === FACE_SKIN_CATEGORY ? 255 : 0;
    const j = i * 4;
    out[j] = 255;
    out[j + 1] = 255;
    out[j + 2] = 255;
    out[j + 3] = on;
  }
  return out;
}

/**
 * Write the skin mask into `canvas` (reused across calls) as an ImageData, for
 * use as a CanvasImageSource clip in the mask compositor.
 */
export function buildSkinMask(
  canvas: HTMLCanvasElement,
  categories: Uint8Array,
  width: number,
  height: number
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for skin mask");
  const imageData = new ImageData(width, height);
  const maskData = skinMaskData(categories, width, height);
  imageData.data.set(maskData);
  ctx.putImageData(imageData, 0, 0);
}
