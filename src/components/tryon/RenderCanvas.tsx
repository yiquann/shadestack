"use client";

import { useEffect, useRef } from "react";
import type { Point } from "@/lib/facemesh/polygon";
import { renderComposite } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
import type { AppliedLayer } from "@/lib/tryon/session";

type Props = {
  image: HTMLImageElement;
  points: Point[];
  width: number;
  height: number;
  layers: AppliedLayer[];
};

export function RenderCanvas({ image, points, width, height, layers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderComposite(canvas, image, buildGlLayers(layers, points, width, height));
  }, [image, points, width, height, layers]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="render-canvas"
      className="pointer-events-none absolute inset-0"
    />
  );
}
