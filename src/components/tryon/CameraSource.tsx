"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { createVideoFaceLandmarker } from "@/lib/facemesh/faceLandmarker";
import {
  nextFacingMode,
  detectionInterval,
  type FacingMode,
} from "@/lib/facemesh/cameraHelpers";
import { useCameraStream } from "@/lib/facemesh/useCameraStream";
import { createCompositeRenderer } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
import type { Point } from "@/lib/facemesh/polygon";
import type { AppliedLayer } from "@/lib/tryon/session";

const WIDTH = 500;
const HEIGHT = 600;
// Cap the render backing store's long edge regardless of the camera's native
// resolution. Masks are re-rasterized (CSS blur) and re-uploaded per layer per
// frame at the canvas size, so an unbounded 1080p feed would blow the 30fps
// budget; and the per-category featherPx values are tuned for a ~500–600px
// canvas, so an unbounded size also hardens the feather. Bounding here fixes
// both. Aspect ratio is preserved, so object-cover still matches the <video>.
const MAX_RENDER_EDGE = 900;
const SHOW_FPS = process.env.NODE_ENV !== "production";

type Props = {
  layers: AppliedLayer[];
};

export function CameraSource({ layers }: Props) {
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const { stream, status, message } = useCameraStream(facingMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(layers);
  const [fps, setFps] = useState(0);

  // Keep the loop reading current layers without restarting on each edit.
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // Attach the stream to the <video>.
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream]);

  // The render/detection loop: lives while a stream is ready.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !video || !canvas) return;

    let cancelled = false;
    let landmarker: FaceLandmarker | null = null;
    let rafId = 0;
    let vfcId = 0;
    let frameCount = 0;
    let lastPoints: Point[] | null = null;
    let avgFrameMs = 1000 / 60;
    let lastTs = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;

    const renderer = createCompositeRenderer(canvas);

    const useVfc = typeof (video as HTMLVideoElement & {
      requestVideoFrameCallback?: unknown;
    }).requestVideoFrameCallback === "function";

    function schedule(cb: () => void) {
      if (useVfc) {
        vfcId = (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        }).requestVideoFrameCallback(cb);
      } else {
        rafId = requestAnimationFrame(cb);
      }
    }

    function tick() {
      if (cancelled || !video || !canvas || !landmarker) return;
      const now = performance.now();
      const frameMs = now - lastTs;
      lastTs = now;
      avgFrameMs = avgFrameMs * 0.9 + frameMs * 0.1;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Size the canvas backing store to the camera's aspect ratio (capped at
        // MAX_RENDER_EDGE) so the base video pass draws without distortion — a
        // full-quad draw into a mismatched fixed size would stretch a landscape
        // feed — and landmark points, normalized to the video frame, map to the
        // right pixels. CSS object-cover then crops the display to match the
        // <video> underneath. Only reassign on change; setting canvas.width
        // resizes (and clears) the drawing buffer.
        const scale = Math.min(1, MAX_RENDER_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const targetW = Math.round(video.videoWidth * scale);
        const targetH = Math.round(video.videoHeight * scale);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const interval = detectionInterval(avgFrameMs);
        if (frameCount % interval === 0) {
          const result = landmarker.detectForVideo(video, now);
          const face = result.faceLandmarks[0];
          lastPoints = face && face.length > 0 ? face.map((p) => ({ x: p.x, y: p.y })) : null;
        }
        const glLayers = lastPoints
          ? buildGlLayers(layersRef.current, lastPoints, canvas.width, canvas.height)
          : [];
        renderer.render(video, glLayers);
      }

      frameCount += 1;
      fpsAccum += frameMs;
      fpsFrames += 1;
      if (SHOW_FPS && fpsAccum >= 500) {
        setFps(Math.round(1000 / (fpsAccum / fpsFrames)));
        fpsAccum = 0;
        fpsFrames = 0;
      }
      schedule(tick);
    }

    createVideoFaceLandmarker().then((lm) => {
      if (cancelled) {
        lm.close();
        return;
      }
      landmarker = lm;
      schedule(tick);
    });

    return () => {
      cancelled = true;
      if (useVfc && "cancelVideoFrameCallback" in video) {
        (video as HTMLVideoElement & {
          cancelVideoFrameCallback: (id: number) => void;
        }).cancelVideoFrameCallback(vfcId);
      } else {
        cancelAnimationFrame(rafId);
      }
      renderer.dispose();
      landmarker?.close();
    };
  }, [status]);

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card bg-ink"
        style={{ width: WIDTH, height: HEIGHT, maxWidth: "100%" }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        {SHOW_FPS && status === "ready" && (
          <span className="absolute left-2 top-2 rounded-pill bg-ink/60 px-2 py-1 text-[10px] font-semibold text-surface">
            {fps} fps
          </span>
        )}
      </div>

      {status === "ready" && (
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setFacingMode(nextFacingMode)}
            className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          >
            Flip camera
          </button>
        </div>
      )}
      {status === "denied" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Camera access is needed for live try-on. Enable it in your browser settings.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          No camera available: {message}
        </p>
      )}
    </div>
  );
}
