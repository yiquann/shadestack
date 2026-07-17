"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

type Props = {
  points: Point[];
  width: number;
  height: number;
};

export function LandmarkDebugOverlay({ points, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const accent = getComputedStyle(canvas).getPropertyValue("--color-accent").trim();
    ctx.fillStyle = accent || "black";
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="landmark-overlay"
      className="pointer-events-none absolute inset-0"
      style={{ animation: "pulse 1.5s ease-in-out infinite" }}
    />
  );
}
