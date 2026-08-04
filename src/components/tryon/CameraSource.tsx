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
import type { AppliedLayer } from "@/lib/tryon/session";
import type { RenderLooks } from "./RenderCanvas";
import { fitWidth, useFitHeight } from "@/lib/tryon/useFitHeight";
import { BeforeAfterOverlay } from "./BeforeAfterOverlay";
import { LookPills } from "./LookPills";

// Segmentation (a second GPU model + a CPU readback) only feeds foundation's
// skin clip. When no foundation is applied it's pure waste, so skip it.
function looksNeedSkinMask(rl: RenderLooks): boolean {
  const has = (ls: AppliedLayer[]) =>
    ls.some((l) => l.visible && l.category === "FOUNDATION");
  return rl.mode === "single" ? has(rl.layers) : has(rl.left) || has(rl.right);
}

const WIDTH = 500;
const HEIGHT = 600;
// Cap the render backing store's long edge regardless of the camera's native
// resolution. Masks are re-rasterized (CSS blur) and re-uploaded per layer per
// frame at the canvas size, so an unbounded 1080p feed would blow the 30fps
// budget; and the per-category featherPx values are tuned for a ~500–600px
// canvas, so an unbounded size also hardens the feather. Bounding here fixes
// both. Aspect ratio is preserved, so object-cover still matches the <video>.
const MAX_RENDER_EDGE = 900;
// Segmentation is a second per-frame model whose getAsUint8Array() readback is
// a synchronous GPU->CPU pipeline flush that stalls the render thread. Run it
// only every Nth frame and reuse the last skin mask between runs. The hairline
// moves slowly, so a low rate (~once per second) is imperceptible while keeping
// the stall off all but a few frames per second.
const SEGMENT_INTERVAL = 30;
// Dev shows the FPS badge automatically; in a production build, opt in with a
// `?fps=1` query param so the true (non-dev) frame rate can be measured.
const SHOW_FPS =
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("fps"));

type Props = {
  looks: RenderLooks;
  facingMode: FacingMode;
};

export function CameraSource({ looks, facingMode }: Props) {
  const { stream, status, message } = useCameraStream(facingMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dividerRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const availableHeight = useFitHeight(fitRef);
  const looksRef = useRef(looks);
  const [fps, setFps] = useState(0);

  // Single look with makeup applied → offer the before/after wipe (the raw
  // <video> is "before", the composited canvas is "after"). Split view uses its
  // own Look A / Look B divider instead.
  const comparing = looks.mode === "single" && looks.compare && looks.layers.length > 0;

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
    // Mask caching: the feathered masks depend only on landmarks (+ look/size),
    // which change at most every detection frame. Track the last inputs so we
    // rebuild the masks only when they actually change and reuse them (and the
    // built GL layers) otherwise, while the video base still redraws every frame.
    let prevPoints: Point[] | null = null;
    let prevLooks: RenderLooks | null = null;
    let prevW = 0;
    let prevH = 0;
    let cachedGlLayers: Layer[] = [];
    let avgFrameMs = 1000 / 60;
    let lastTs = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;
    // TEMP FPS DIAGNOSTIC: rolling sum of per-frame work time (ms), plus a
    // per-stage breakdown so we can see which stage eats the budget.
    let workAccum = 0;
    let detectAccum = 0;
    let segAccum = 0;
    let renderAccum = 0;

    const renderer = createCompositeRenderer(canvas);
    const leftMask = document.createElement("canvas");
    const rightMask = document.createElement("canvas");
    const divider = dividerRef.current;

    // Scheduler: default to requestVideoFrameCallback when available.
    // TEMP FPS DIAGNOSTIC: ?sched=raf forces requestAnimationFrame and
    // ?sched=vfc forces vfc, so the two can be A/B'd live to see whether vfc is
    // being starved by GPU/video-presentation contention.
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const schedParam = params.get("sched");
    // TEMP FPS DIAGNOSTIC: ?segread=off keeps calling segmentForVideo but skips
    // the getAsUint8Array() readback, to separate the GPU->CPU readback stall
    // from the segment inference cost itself.
    const skipSegRead = params.get("segread") === "off";
    const hasVfc = typeof (video as HTMLVideoElement & {
      requestVideoFrameCallback?: unknown;
    }).requestVideoFrameCallback === "function";
    const useVfc = schedParam === "raf" ? false : schedParam === "vfc" ? true : hasVfc;
    if (SHOW_FPS) {
      // eslint-disable-next-line no-console
      console.log(`[fps-diag] scheduler = ${useVfc ? "requestVideoFrameCallback" : "requestAnimationFrame"}`);
    }

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
      // TEMP FPS DIAGNOSTIC: measure the actual work this frame spends.
      const workStart = performance.now();

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
        const rl = looksRef.current;
        // When the before/after compare is on, the extra compositing tightens
        // the frame budget; detect and segment less often so the render loop
        // stays in step with the live video and the seam doesn't judder.
        const comparingNow =
          rl.mode === "single" && rl.compare && rl.layers.length > 0;
        const interval = comparingNow
          ? Math.max(2, detectionInterval(avgFrameMs))
          : detectionInterval(avgFrameMs);
        if (frameCount % interval === 0) {
          const t0 = performance.now();
          const result = landmarker.detectForVideo(video, now);
          const face = result.faceLandmarks[0];
          lastPoints = face && face.length > 0 ? face.map((p) => ({ x: p.x, y: p.y })) : null;
          detectAccum += performance.now() - t0; // TEMP FPS DIAGNOSTIC
        }
        const segInterval = comparingNow ? SEGMENT_INTERVAL * 2 : SEGMENT_INTERVAL;
        if (segmenter && looksNeedSkinMask(rl) && frameCount % segInterval === 0) {
          const t0 = performance.now(); // TEMP FPS DIAGNOSTIC
          segmenter.segmentForVideo(video, now, (result) => {
            const mask = result.categoryMask;
            if (!mask) return;
            try {
              // TEMP FPS DIAGNOSTIC: skip the readback under ?segread=off.
              if (!skipSegRead) {
                buildSkinMask(skinCanvas, mask.getAsUint8Array(), mask.width, mask.height);
                skinReady = true;
              }
            } finally {
              mask.close();
            }
          });
          segAccum += performance.now() - t0; // TEMP FPS DIAGNOSTIC
        }
        const clip = skinReady ? skinCanvas : undefined;
        // Rebuild the masks only when their inputs changed since the last frame:
        // new landmarks (a fresh detection), an edited look, or a resized canvas.
        const rebuildMasks =
          lastPoints !== prevPoints ||
          rl !== prevLooks ||
          canvas.width !== prevW ||
          canvas.height !== prevH;
        prevPoints = lastPoints;
        prevLooks = rl;
        prevW = canvas.width;
        prevH = canvas.height;
        const tRender = performance.now(); // TEMP FPS DIAGNOSTIC
        if (rebuildMasks) {
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
              // The canvas is displayed mirrored (scaleX(-1)), so a look drawn
              // into the canvas's left half appears on the viewer's right. Draw
              // Look A (rl.left) into the right-half mask and Look B (rl.right)
              // into the left-half mask so that, after mirroring, the viewer sees
              // Look A on the left and Look B on the right.
              glLayers = [
                ...buildGlLayers(rl.left, lastPoints, canvas.width, canvas.height, clip, rightMask),
                ...buildGlLayers(rl.right, lastPoints, canvas.width, canvas.height, clip, leftMask),
              ];
            }
          }
          cachedGlLayers = glLayers;
        }
        renderer.render(video, cachedGlLayers, rebuildMasks);
        renderAccum += performance.now() - tRender; // TEMP FPS DIAGNOSTIC

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
      // TEMP FPS DIAGNOSTIC: accumulate work time and, once per second, log
      // average work-per-frame vs. the average frame interval. If work << frame
      // interval, we're camera-bound (H1); if work ≈ frame interval, work-bound (H2).
      workAccum += performance.now() - workStart;
      if (SHOW_FPS && fpsAccum >= 500) {
        setFps(Math.round(1000 / (fpsAccum / fpsFrames)));
        // eslint-disable-next-line no-console
        console.log(
          `[fps-diag] fps=${Math.round(1000 / (fpsAccum / fpsFrames))} ` +
            `frameInterval=${(fpsAccum / fpsFrames).toFixed(1)}ms ` +
            `work/frame=${(workAccum / fpsFrames).toFixed(1)}ms ` +
            `| detect=${(detectAccum / fpsFrames).toFixed(1)} ` +
            `seg=${(segAccum / fpsFrames).toFixed(1)} ` +
            `render+masks=${(renderAccum / fpsFrames).toFixed(1)} (avg/frame)`
        );
        fpsAccum = 0;
        fpsFrames = 0;
        workAccum = 0;
        detectAccum = 0;
        segAccum = 0;
        renderAccum = 0;
      }
      schedule(tick);
    }

    // --- TEMP FPS DIAGNOSTIC (remove after root-cause) ------------------
    // Logs the camera's negotiated settings once, so we can see whether the
    // sensor is only delivering ~15fps (camera-bound) vs. the render loop
    // overrunning its budget (work-bound).
    {
      const track = stream?.getVideoTracks?.()[0];
      if (track) {
        // eslint-disable-next-line no-console
        console.log("[fps-diag] camera settings", track.getSettings());
      }
    }
    // --------------------------------------------------------------------

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
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      {status === "denied" && (
        <p className="mb-2 shrink-0 text-center text-xs text-textMuted">
          Camera access is needed for live try-on. Enable it in your browser settings.
        </p>
      )}
      {status === "error" && (
        <p className="mb-2 shrink-0 text-center text-xs text-textMuted">
          No camera available: {message}
        </p>
      )}
      {/* items-end: leftover height pools above, so the frame's lower edge lands
          on the dock boundary — which is what marks the division now that the
          dock draws no rule of its own. Status copy sits above the frame for the
          same reason. */}
      <div ref={fitRef} className="flex min-h-0 w-full flex-1 items-end justify-center">
        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-card bg-ink"
          // Width derives from the measured free height so the box keeps the 3:4
          // ratio the mirrored canvas overlay assumes — see useFitHeight.
          style={{
            aspectRatio: "3 / 4",
            width: fitWidth(availableHeight, 3, 4),
          }}
        >
        {/* "before": the raw camera feed */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        {/* "after": the composited canvas, clipped to the right of the wipe when
            comparing. The wrapper is always present so the canvas ref is stable
            across the render loop (never remounts when the wipe toggles). */}
        <div
          className="absolute inset-0"
          style={comparing ? { clipPath: "inset(0 0 0 var(--wipe, 50%))" } : undefined}
        >
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
        <canvas
          ref={dividerRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />
          <LookPills looks={looks} />
          {comparing && <BeforeAfterOverlay targetRef={containerRef} />}
          {SHOW_FPS && status === "ready" && (
            <span className="absolute left-2 top-2 rounded-pill bg-ink/60 px-2 py-1 text-[10px] font-semibold text-surface">
              {fps} fps
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
