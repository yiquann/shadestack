"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { createVideoFaceLandmarker } from "@/lib/facemesh/faceLandmarker";
import { detectionInterval, type FacingMode } from "@/lib/facemesh/cameraHelpers";
import { useCameraStream } from "@/lib/facemesh/useCameraStream";
import { createCompositeRenderer, type Layer } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
import { createVideoSegmenter } from "@/lib/segment/imageSegmenter";
import { buildSkinMask } from "@/lib/segment/skinMask";
import { buildHalfMask } from "@/lib/webgl/regionMask";
import type { Point } from "@/lib/facemesh/polygon";
import type { RenderLooks } from "./RenderCanvas";

const WIDTH = 500;
const HEIGHT = 600;
// Cap the render backing store's long edge regardless of the camera's native
// resolution. Masks are re-rasterized (CSS blur) and re-uploaded per layer per
// frame at the canvas size, so an unbounded 1080p feed would blow the 30fps
// budget; and the per-category featherPx values are tuned for a ~500–600px
// canvas, so an unbounded size also hardens the feather. Bounding here fixes
// both. Aspect ratio is preserved, so object-cover still matches the <video>.
const MAX_RENDER_EDGE = 900;
// Segmentation is a second per-frame model; run it every Nth frame and reuse
// the last skin mask between runs to protect the frame budget.
const SEGMENT_INTERVAL = 4;
const SHOW_FPS = process.env.NODE_ENV !== "production";

type Props = {
  looks: RenderLooks;
  facingMode: FacingMode;
};

export function CameraSource({ looks, facingMode }: Props) {
  const { stream, status, message } = useCameraStream(facingMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dividerRef = useRef<HTMLCanvasElement>(null);
  const looksRef = useRef(looks);
  const [fps, setFps] = useState(0);

  // Keep the loop reading current looks without restarting on each edit.
  useEffect(() => {
    looksRef.current = looks;
  }, [looks]);

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
    let segmenter: ImageSegmenter | null = null;
    let skinReady = false;
    const skinCanvas = document.createElement("canvas");
    let rafId = 0;
    let vfcId = 0;
    let frameCount = 0;
    let lastPoints: Point[] | null = null;
    let avgFrameMs = 1000 / 60;
    let lastTs = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;

    const renderer = createCompositeRenderer(canvas);
    const leftMask = document.createElement("canvas");
    const rightMask = document.createElement("canvas");
    const divider = dividerRef.current;

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
        if (segmenter && frameCount % SEGMENT_INTERVAL === 0) {
          segmenter.segmentForVideo(video, now, (result) => {
            const mask = result.categoryMask;
            if (!mask) return;
            try {
              buildSkinMask(skinCanvas, mask.getAsUint8Array(), mask.width, mask.height);
              skinReady = true;
            } finally {
              mask.close();
            }
          });
        }
        const rl = looksRef.current;
        const clip = skinReady ? skinCanvas : undefined;
        let glLayers: Layer[] = [];
        if (lastPoints) {
          if (rl.mode === "single") {
            glLayers = buildGlLayers(rl.layers, lastPoints, canvas.width, canvas.height, clip);
          } else {
            // The camera split is a fixed vertical line down the middle of the
            // frame — it does not tilt or follow the face (unlike photo/model).
            const cx = canvas.width / 2;
            const top = { x: cx, y: 0 };
            const bottom = { x: cx, y: canvas.height };
            buildHalfMask(leftMask, top, bottom, "left", canvas.width, canvas.height);
            buildHalfMask(rightMask, top, bottom, "right", canvas.width, canvas.height);
            glLayers = [
              ...buildGlLayers(rl.left, lastPoints, canvas.width, canvas.height, clip, leftMask),
              ...buildGlLayers(rl.right, lastPoints, canvas.width, canvas.height, clip, rightMask),
            ];
          }
        }
        renderer.render(video, glLayers);

        if (divider) {
          if (divider.width !== canvas.width) divider.width = canvas.width;
          if (divider.height !== canvas.height) divider.height = canvas.height;
          const dctx = divider.getContext("2d");
          if (dctx) {
            dctx.clearRect(0, 0, divider.width, divider.height);
            if (rl.mode === "split" && rl.divider) {
              const cx = divider.width / 2;
              dctx.strokeStyle = "rgba(255,255,255,0.9)";
              dctx.lineWidth = 4;
              dctx.beginPath();
              dctx.moveTo(cx, 0);
              dctx.lineTo(cx, divider.height);
              dctx.stroke();
            }
          }
        }
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

    createVideoSegmenter()
      .then((sg) => {
        if (cancelled) {
          sg.close();
          return;
        }
        segmenter = sg;
      })
      .catch(() => {
        // Segmentation unavailable -> foundation falls back to the extended oval.
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
      segmenter?.close();
    };
  }, [status]);

  return (
    <div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-card bg-ink">
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
        <canvas
          ref={dividerRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />
        {SHOW_FPS && status === "ready" && (
          <span className="absolute left-2 top-2 rounded-pill bg-ink/60 px-2 py-1 text-[10px] font-semibold text-surface">
            {fps} fps
          </span>
        )}
      </div>

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
