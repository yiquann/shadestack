import { describe, expect, it } from "vitest";
import { midlineEndpoints } from "./midline";
import type { Point } from "./polygon";

const POINTS: Point[] = Array.from({ length: 468 }, (_, i) => ({
  x: i === 10 ? 0.5 : i === 152 ? 0.5 : 0,
  y: i === 10 ? 0.1 : i === 152 ? 0.9 : 0,
}));

describe("midlineEndpoints", () => {
  it("maps forehead (10) and chin (152) to canvas pixels", () => {
    expect(midlineEndpoints(POINTS, 200, 400)).toEqual({
      top: { x: 100, y: 40 },
      bottom: { x: 100, y: 360 },
    });
  });
});
