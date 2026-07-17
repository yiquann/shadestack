import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { hexToRgb01, type Layer } from "./compositor";
import { CATEGORY_RENDER } from "./categoryZones";
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
      return config.entries.map(({ zone, featherPx }) => ({
        polygon: landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height),
        tintColor: hexToRgb01(l.product.colorHex),
        opacity: config.baseOpacity * l.opacity,
        blendMode: config.blendMode,
        featherPx,
      }));
    });
}
