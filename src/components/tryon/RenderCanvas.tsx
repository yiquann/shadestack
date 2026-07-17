"use client";

import { useEffect, useRef } from "react";
import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { renderComposite, hexToRgb01, type Layer } from "@/lib/webgl/compositor";
import { CATEGORY_RENDER } from "@/lib/webgl/categoryZones";
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

    const glLayers: Layer[] = layers
      .filter((l) => l.visible)
      .flatMap((l) => {
        const config = CATEGORY_RENDER[l.category];
        return config.entries.map(({ zone, featherPx }) => ({
          polygon: landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height),
          tintColor: hexToRgb01(l.product.colorHex),
          opacity: config.baseOpacity * l.opacity,
          blendMode: config.blendMode,
          featherPx,
        }));
      });

    renderComposite(canvas, image, glLayers);
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
