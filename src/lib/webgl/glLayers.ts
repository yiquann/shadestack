import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { hexToRgb01, type Layer } from "./compositor";
import { CATEGORY_RENDER, COVERAGE_SMOOTHING, normalizeCoverage } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";

// MediaPipe's mesh tops out at landmark 10 (mid-forehead) — there are no
// hairline landmarks — so the raw face oval leaves the upper forehead bare.
// These top-arc oval vertices are lifted toward the hairline; because the lift
// is vertical-only and proportional to each point's distance above the nasion
// (landmark 168, between the eyes), the center rises most and the sides least,
// keeping a smooth dome without widening the temples.
const FOREHEAD_TOP = new Set([10, 338, 297, 332, 284, 109, 67, 103, 54]);
const FOREHEAD_LIFT = 1.9;
const NASION = 168;

function faceOvalPolygon(points: Point[], width: number, height: number): Point[] {
  const anchorY = points[NASION].y * height;
  return ZONE_LANDMARKS.faceOval.map((idx) => {
    const x = points[idx].x * width;
    const y = points[idx].y * height;
    if (!FOREHEAD_TOP.has(idx)) return { x, y };
    return { x, y: anchorY + (y - anchorY) * FOREHEAD_LIFT };
  });
}

function zonePolygon(
  zone: keyof typeof ZONE_LANDMARKS,
  points: Point[],
  width: number,
  height: number
): Point[] {
  if (zone === "faceOval") return faceOvalPolygon(points, width, height);
  return landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height);
}

export function buildGlLayers(
  layers: AppliedLayer[],
  points: Point[],
  width: number,
  height: number,
  clipMask?: CanvasImageSource
): Layer[] {
  return layers
    .filter((l) => l.visible)
    .flatMap((l) => {
      const config = CATEGORY_RENDER[l.category];
      const tintColor = hexToRgb01(l.product.colorHex);
      // Only the full-face foundation blur is clipped to the detected skin.
      const layerClip = config.smooth === "coverage" ? clipMask : undefined;

      // featherPx values are tuned against a ~600px canvas; scale them with the
      // actual canvas so raising the render resolution doesn't harden the edges.
      const featherScale = Math.max(width, height) / 600;

      let smoothStrength = 0;
      let tintOpacity = config.baseOpacity * l.opacity;
      if (config.smooth === "coverage") {
        const cov =
          COVERAGE_SMOOTHING[normalizeCoverage(l.product.coverage)] ??
          COVERAGE_SMOOTHING.medium;
        smoothStrength = cov.blur;
        tintOpacity = cov.tint * l.opacity;
      } else if (config.smooth === "light") {
        smoothStrength = COVERAGE_SMOOTHING.light.blur;
      }

      // A full-face foundation blur must skip the eyes and lips, or those
      // features soften and the whole face reads as a resolution drop. Smaller
      // product zones (blush/bronzer cheek + temple patches) contain no
      // features, so they need no holes.
      const smoothHoles: Point[][] | undefined =
        config.smooth === "coverage"
          ? [
              landmarksToPolygon(points, ZONE_LANDMARKS.leftEye, width, height),
              landmarksToPolygon(points, ZONE_LANDMARKS.rightEye, width, height),
              landmarksToPolygon(points, ZONE_LANDMARKS.lips, width, height),
            ]
          : undefined;

      return config.entries.flatMap(({ zone, featherPx }): Layer[] => {
        const polygon = zonePolygon(zone, points, width, height);
        const scaledFeather = featherPx * featherScale;
        const tint: Layer = {
          kind: "tint",
          polygon,
          tintColor,
          opacity: tintOpacity,
          blendMode: config.blendMode,
          featherPx: scaledFeather,
          clipMask: layerClip,
        };
        if (smoothStrength > 0) {
          const smooth: Layer = {
            kind: "smooth",
            polygon,
            strength: smoothStrength,
            featherPx: scaledFeather,
            holes: smoothHoles,
            clipMask: layerClip,
          };
          return [smooth, tint];
        }
        return [tint];
      });
    });
}
