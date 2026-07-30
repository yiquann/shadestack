export type FacingMode = "user" | "environment";

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === "user" ? "environment" : "user";
}

const FPS_30_MS = 1000 / 30;
const FPS_45_MS = 1000 / 45;

/**
 * How many frames to draw between landmark detections — the draw runs every
 * frame; detection is throttled to ~30/sec, which is plenty for smooth tracking:
 * - Below 30fps (frame time past the 30fps budget): detect every other frame to
 *   help the frame rate recover, before any resolution drop.
 * - Above ~45fps (e.g. a 60fps feed): detect every other frame too, so running
 *   the (expensive) detector every frame doesn't eat the per-frame budget and
 *   the draw loop can actually reach 60fps.
 * - In the ~30–45fps band: detect every frame.
 * Guards against 0/NaN.
 */
export function detectionInterval(avgFrameMs: number): number {
  if (!Number.isFinite(avgFrameMs) || avgFrameMs <= 0) return 1;
  if (avgFrameMs > FPS_30_MS) return 2;
  if (avgFrameMs < FPS_45_MS) return 2;
  return 1;
}
