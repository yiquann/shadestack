import { describe, expect, it } from "vitest";
import { buildGlLayers } from "./glLayers";
import { CATEGORY_RENDER, COVERAGE_SMOOTHING } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";
import type { Point } from "@/lib/facemesh/polygon";

// 468 dummy normalized landmarks so any zone index resolves.
const POINTS: Point[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));

function layer(overrides: Partial<AppliedLayer>): AppliedLayer {
  return {
    category: "LIPSTICK",
    product: { colorHex: "#B0002E", coverage: "" } as AppliedLayer["product"],
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
    expect(first.kind).toBe("tint");
    if (first.kind !== "tint") throw new Error("expected tint layer");
    expect(first.opacity).toBeCloseTo(base * 0.5);
    expect(first.blendMode).toBe(CATEGORY_RENDER.LIPSTICK.blendMode);
  });

  it("emits only tint layers for a non-smoothing category (LIPSTICK)", () => {
    const applied = layer({ category: "LIPSTICK" });
    const result = buildGlLayers([applied], POINTS, 100, 100);
    expect(result).toHaveLength(CATEGORY_RENDER.LIPSTICK.entries.length);
    for (const l of result) {
      expect(l.kind).toBe("tint");
    }
  });

  it("emits a [smooth, tint] pair for FOUNDATION with Full coverage", () => {
    const applied = layer({
      category: "FOUNDATION",
      product: { colorHex: "#E8C8A4", coverage: "Full" } as AppliedLayer["product"],
      opacity: 0.8,
    });
    const result = buildGlLayers([applied], POINTS, 100, 100);
    expect(result).toHaveLength(2 * CATEGORY_RENDER.FOUNDATION.entries.length);
    const [smooth, tint] = result;
    expect(smooth.kind).toBe("smooth");
    if (smooth.kind !== "smooth") throw new Error("expected smooth layer");
    expect(smooth.strength).toBe(COVERAGE_SMOOTHING.full.blur);
    expect(tint.kind).toBe("tint");
    if (tint.kind !== "tint") throw new Error("expected tint layer");
    expect(tint.opacity).toBeCloseTo(COVERAGE_SMOOTHING.full.tint * 0.8);
  });

  it("falls back to medium coverage for an unknown coverage string", () => {
    const applied = layer({
      category: "FOUNDATION",
      product: { colorHex: "#E8C8A4", coverage: "Unknown" } as AppliedLayer["product"],
      opacity: 1,
    });
    const [smooth, tint] = buildGlLayers([applied], POINTS, 100, 100);
    if (smooth.kind !== "smooth" || tint.kind !== "tint") throw new Error("unexpected kinds");
    expect(smooth.strength).toBe(COVERAGE_SMOOTHING.medium.blur);
    expect(tint.opacity).toBeCloseTo(COVERAGE_SMOOTHING.medium.tint * 1);
  });

  it("emits a [smooth, tint] pair per cheek zone for BLUSH with unchanged pigment", () => {
    const applied = layer({
      category: "BLUSH",
      product: { colorHex: "#E8A0A0", coverage: "" } as AppliedLayer["product"],
      opacity: 0.6,
    });
    const result = buildGlLayers([applied], POINTS, 100, 100);
    expect(result).toHaveLength(2 * CATEGORY_RENDER.BLUSH.entries.length);
    for (let i = 0; i < result.length; i += 2) {
      const smooth = result[i];
      const tint = result[i + 1];
      if (smooth.kind !== "smooth" || tint.kind !== "tint") throw new Error("unexpected kinds");
      expect(smooth.strength).toBe(COVERAGE_SMOOTHING.light.blur);
      expect(tint.opacity).toBeCloseTo(CATEGORY_RENDER.BLUSH.baseOpacity * 0.6);
    }
  });
});
