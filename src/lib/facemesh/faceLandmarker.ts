import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function create(runningMode: "IMAGE" | "VIDEO"): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      // IMAGE mode is a one-shot detect (Photo/Model) — run it on the CPU
      // delegate so it never competes for, or gets evicted from, the shared
      // WebGL context pool that the live camera loop + compositor hold on the
      // GPU. GPU-context eviction was intermittently making a valid selfie
      // return zero faces ("no face detected"). VIDEO mode (the per-frame
      // camera loop) stays on GPU for speed.
      delegate: runningMode === "VIDEO" ? "GPU" : "CPU",
    },
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
