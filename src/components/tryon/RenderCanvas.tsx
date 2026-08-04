"use client";

import { useEffect, useRef } from "react";
import type { Point } from "@/lib/facemesh/polygon";
import { createCompositeRenderer, type CompositeRenderer, type Layer } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
import { midlineEndpoints, fullSpanMidline } from "@/lib/facemesh/midline";
import { buildHalfMask } from "@/lib/webgl/regionMask";
import type { AppliedLayer, LookId } from "@/lib/tryon/session";

export type RenderLooks =
  | { mode: "single"; layers: AppliedLayer[]; compare: boolean }
  | {
      mode: "split";
      left: AppliedLayer[];
      right: AppliedLayer[];
      divider: boolean;
      /**
       * Which look each half is showing. The renderer itself does not need
       * these — it only composites `left` and `right` — but LookPills labels the
       * halves from them, and they must be filled from the same expression that
       * chose the layer arrays or the label can disagree with the face.
       */
      leftLook: LookId;
      rightLook: LookId;
    };

type Props = {
  image: HTMLImageElement;
  points: Point[];
  width: number;
  height: number;
  looks: RenderLooks;
  clipMask?: CanvasImageSource;
  /**
   * How the canvas is fitted when the display box's aspect ratio differs from
   * `width`/`height` — must match whatever the underlying <img>/<video> uses, or
   * the composite is scaled differently from the face beneath it and the makeup
   * slides off. Omit when the box already matches the source ratio exactly.
   */
  objectFit?: "contain" | "cover";
};

export function RenderCanvas({
  image,
  points,
  width,
  height,
  looks,
  clipMask,
  objectFit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dividerRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CompositeRenderer | null>(null);
  const leftMaskRef = useRef<HTMLCanvasElement | null>(null);
  const rightMaskRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createCompositeRenderer(canvas);
    rendererRef.current = renderer;
    leftMaskRef.current = document.createElement("canvas");
    rightMaskRef.current = document.createElement("canvas");
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    let glLayers: Layer[];
    if (looks.mode === "single") {
      glLayers = buildGlLayers(looks.layers, points, width, height, clipMask);
    } else {
      const left = leftMaskRef.current;
      const right = rightMaskRef.current;
      if (!left || !right) return;
      const { top, bottom } = midlineEndpoints(points, width, height);
      buildHalfMask(left, top, bottom, "left", width, height);
      buildHalfMask(right, top, bottom, "right", width, height);
      glLayers = [
        ...buildGlLayers(looks.left, points, width, height, clipMask, left),
        ...buildGlLayers(looks.right, points, width, height, clipMask, right),
      ];
    }
    renderer.render(image, glLayers);

    const dcanvas = dividerRef.current;
    if (!dcanvas) return;
    if (dcanvas.width !== width) dcanvas.width = width;
    if (dcanvas.height !== height) dcanvas.height = height;
    const ctx = dcanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (looks.mode === "split" && looks.divider) {
      const { top, bottom } = midlineEndpoints(points, width, height);
      const { start, end } = fullSpanMidline(top, bottom, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }, [image, points, width, height, looks, clipMask]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-testid="render-canvas"
        style={objectFit ? { objectFit } : undefined}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <canvas
        ref={dividerRef}
        width={width}
        height={height}
        style={objectFit ? { objectFit } : undefined}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </>
  );
}
