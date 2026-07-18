import type { Point } from "./polygon";

const FOREHEAD_CENTER = 10;
const CHIN = 152;

export function midlineEndpoints(
  points: Point[],
  width: number,
  height: number
): { top: Point; bottom: Point } {
  return {
    top: {
      x: points[FOREHEAD_CENTER].x * width,
      y: points[FOREHEAD_CENTER].y * height,
    },
    bottom: {
      x: points[CHIN].x * width,
      y: points[CHIN].y * height,
    },
  };
}
