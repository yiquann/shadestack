import { describe, expect, it } from "vitest";
import { landmarksToPolygon } from "./polygon";

describe("landmarksToPolygon", () => {
  it("maps normalized landmark coordinates to pixel space", () => {
    const landmarks = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    const result = landmarksToPolygon(landmarks, [0, 1, 2], 500, 600);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 250, y: 300 },
      { x: 500, y: 600 },
    ]);
  });

  it("selects only the requested indices, in the given order", () => {
    const landmarks = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
    ];
    const result = landmarksToPolygon(landmarks, [2, 0], 100, 100);
    expect(result).toEqual([
      { x: 30, y: 30 },
      { x: 10, y: 10 },
    ]);
  });
});
