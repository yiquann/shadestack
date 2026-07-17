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
    const leftEyePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.leftEye, width, height);
    const rightEyePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.rightEye, width, height);
    const leftCheekPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.leftCheek, width, height);
    const rightCheekPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.rightCheek, width, height);
    const foreheadPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.forehead, width, height);
    const jawlinePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.jawline, width, height);
    const faceOvalPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.faceOval, width, height);

    const layers: Layer[] = [
      // Foundation: full-face, multiply, ~0.15-0.20 opacity
      {
        polygon: faceOvalPolygon,
        tintColor: hexToRgb01("#D9A876"),
        opacity: 0.18,
        blendMode: "multiply",
        featherPx: 8,
      },
      // Bronzer: temples + jawline, multiply, ~0.14-0.22, heaviest blur
      // Split into two separate draw calls (forehead, jawline) rather than one
      // combined polygon: a single mask-fill over the concatenated point list
      // traces one connected shape between the two regions (verified visually
      // via Playwright — the combined polygon drew a diagonal band across the
      // eyes/nose/mouth), same pattern as the two cheek layers below.
      {
        polygon: foreheadPolygon,
        tintColor: hexToRgb01("#A87552"),
        opacity: 0.18,
        blendMode: "multiply",
        featherPx: 14,
      },
      {
        polygon: jawlinePolygon,
        tintColor: hexToRgb01("#A87552"),
        opacity: 0.18,
        blendMode: "multiply",
        featherPx: 14,
      },
      // Blush: cheek zones, multiply, ~0.32 opacity, heavy feather
      {
        polygon: leftCheekPolygon,
        tintColor: hexToRgb01("#E8A0A0"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 12,
      },
      {
        polygon: rightCheekPolygon,
        tintColor: hexToRgb01("#E8A0A0"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 12,
      },
      // Highlighter: cheekbones + nose bridge, screen, ~0.20-0.30
      {
        polygon: [...leftCheekPolygon, ...rightCheekPolygon],
        tintColor: hexToRgb01("#F0D8B8"),
        opacity: 0.25,
        blendMode: "screen",
        featherPx: 10,
      },
      // Eyeshadow: lid zones, multiply, ~0.32, tight feather
      {
        polygon: leftEyePolygon,
        tintColor: hexToRgb01("#C9A876"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 3,
      },
      {
        polygon: rightEyePolygon,
        tintColor: hexToRgb01("#C9A876"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 3,
      },
      // Lipstick: lip zone, multiply, ~0.55 (drawn last / on top)
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
