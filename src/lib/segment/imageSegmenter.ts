import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function create(runningMode: "IMAGE" | "VIDEO"): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode,
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

/** Cached IMAGE-mode singleton for Photo (one-shot segment). */
export function getImageSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = create("IMAGE");
  }
  return segmenterPromise;
}

/**
 * A fresh VIDEO-mode segmenter for the live camera loop. Not cached: the caller
 * owns it and must call `.close()` when the camera view unmounts.
 */
export function createVideoSegmenter(): Promise<ImageSegmenter> {
  return create("VIDEO");
}
