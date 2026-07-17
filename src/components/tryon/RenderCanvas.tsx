"use client";

import { useEffect, useRef } from "react";
import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { renderComposite, hexToRgb01, type Layer } from "@/lib/webgl/compositor";

type Props = {
  image: HTMLImageElement;
  points: Point[];
  width: number;
  height: number;
};

export function RenderCanvas({ image, points, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const lipsPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.lips, width, height);
    const layers: Layer[] = [
      {
        polygon: lipsPolygon,
        tintColor: hexToRgb01("#B23A3A"),
        opacity: 0.55,
        blendMode: "multiply",
        featherPx: 2,
      },
    ];

    renderComposite(canvas, image, layers);
  }, [image, points, width, height]);

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
