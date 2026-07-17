export type FacingMode = "user" | "environment";

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === "user" ? "environment" : "user";
}

const FPS_30_MS = 1000 / 30;
const FPS_24_MS = 1000 / 24;

/**
 * How many frames to draw between landmark detections. At/above 30fps we detect
 * every frame; once the rolling frame time slips past the 30fps budget we detect
 * every other frame (keep drawing the last composite) to protect frame rate —
 * before any resolution drop, per the 30fps target. Guards against 0/NaN.
 */
export function detectionInterval(avgFrameMs: number): number {
  if (!Number.isFinite(avgFrameMs) || avgFrameMs <= FPS_30_MS) return 1;
  // avgFrameMs > FPS_30_MS (i.e. below 30fps): halve detection cadence.
  void FPS_24_MS;
  return 2;
}
