import { describe, expect, it } from "vitest";
import { midlineEndpoints, fullSpanMidline } from "./midline";
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

describe("fullSpanMidline", () => {
  it("extends a vertical line to the top and bottom edges", () => {
    expect(fullSpanMidline({ x: 100, y: 40 }, { x: 100, y: 360 }, 200, 400)).toEqual({
      start: { x: 100, y: 0 },
      end: { x: 100, y: 400 },
    });
  });

  it("follows the tilt when extending to the edges", () => {
    // slope dx/dy = 20/200 = 0.1 per y; at y=0 -> x=90, at y=400 -> x=130
    expect(fullSpanMidline({ x: 100, y: 100 }, { x: 120, y: 300 }, 200, 400)).toEqual({
      start: { x: 90, y: 0 },
      end: { x: 130, y: 400 },
    });
  });
});
