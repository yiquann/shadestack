import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function create(runningMode: "IMAGE" | "VIDEO"): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode,
    numFaces: 1,
  });
}

/** Cached IMAGE-mode singleton for Model and Photo (one-shot detect). */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create("IMAGE");
  }
  return landmarkerPromise;
}

/**
 * A fresh VIDEO-mode landmarker for the live camera loop. Not cached: the
 * caller owns it and must call `.close()` when the camera view unmounts.
 */
export function createVideoFaceLandmarker(): Promise<FaceLandmarker> {
  return create("VIDEO");
}
