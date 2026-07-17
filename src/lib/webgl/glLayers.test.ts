import { describe, expect, it } from "vitest";
import { buildGlLayers } from "./glLayers";
import { CATEGORY_RENDER } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";
import type { Point } from "@/lib/facemesh/polygon";

// 468 dummy normalized landmarks so any zone index resolves.
const POINTS: Point[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));

function layer(overrides: Partial<AppliedLayer>): AppliedLayer {
  return {
    category: "LIPSTICK",
    product: { colorHex: "#B0002E" } as AppliedLayer["product"],
    opacity: 1,
    visible: true,
    ...overrides,
  };
}

describe("buildGlLayers", () => {
  it("skips layers that are not visible", () => {
    const result = buildGlLayers([layer({ visible: false })], POINTS, 100, 100);
    expect(result).toHaveLength(0);
  });

  it("emits one gl layer per configured zone entry", () => {
    const applied = layer({ category: "LIPSTICK" });
    const expected = CATEGORY_RENDER.LIPSTICK.entries.length;
    expect(buildGlLayers([applied], POINTS, 100, 100)).toHaveLength(expected);
  });

  it("scales base opacity by the per-layer opacity", () => {
    const applied = layer({ category: "LIPSTICK", opacity: 0.5 });
    const base = CATEGORY_RENDER.LIPSTICK.baseOpacity;
    const [first] = buildGlLayers([applied], POINTS, 100, 100);
    expect(first.opacity).toBeCloseTo(base * 0.5);
    expect(first.blendMode).toBe(CATEGORY_RENDER.LIPSTICK.blendMode);
  });
});
