import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { hexToRgb01, type Layer } from "./compositor";
import { CATEGORY_RENDER, COVERAGE_SMOOTHING, normalizeCoverage } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";

export function buildGlLayers(
  layers: AppliedLayer[],
  points: Point[],
  width: number,
  height: number
): Layer[] {
  return layers
    .filter((l) => l.visible)
    .flatMap((l) => {
      const config = CATEGORY_RENDER[l.category];
      const tintColor = hexToRgb01(l.product.colorHex);

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

      return config.entries.flatMap(({ zone, featherPx }): Layer[] => {
        const polygon = landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height);
        const tint: Layer = {
          kind: "tint",
          polygon,
          tintColor,
          opacity: tintOpacity,
          blendMode: config.blendMode,
          featherPx,
        };
        if (smoothStrength > 0) {
          const smooth: Layer = { kind: "smooth", polygon, strength: smoothStrength, featherPx };
          return [smooth, tint];
        }
        return [tint];
      });
    });
}
