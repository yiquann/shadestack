import { describe, expect, it } from "vitest";
import { midlineEndpoints, fullSpanMidline } from "./midline";
import type { Point } from "./polygon";

describe("midlineEndpoints", () => {
  it("fits a vertical axis centred on a vertical midline cloud", () => {
    // All landmarks on x=0.5 with a vertical spread → axis vertical through 0.5.
    const pts: Point[] = Array.from({ length: 468 }, (_, i) => ({ x: 0.5, y: i / 468 }));
    const res = midlineEndpoints(pts, 200, 400);
    expect(res.top.x).toBeCloseTo(100);
    expect(res.bottom.x).toBeCloseTo(100);
    expect(res.bottom.y).toBeGreaterThan(res.top.y);
  });

  it("follows a rightward (down-right) tilt", () => {
    // x grows with y → the axis tilts down-right, so the lower endpoint is to the right.
    const pts: Point[] = Array.from({ length: 468 }, (_, i) => {
      const y = i / 468;
      return { x: 0.4 + 0.2 * y, y };
    });
    const res = midlineEndpoints(pts, 200, 400);
    expect(res.bottom.x).toBeGreaterThan(res.top.x);
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
