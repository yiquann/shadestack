import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createFaceLandmarker();
  }
  return landmarkerPromise;
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });
}
