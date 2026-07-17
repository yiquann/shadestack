export type Point = { x: number; y: number };

export function landmarksToPolygon(
  landmarks: Point[],
  indices: readonly number[],
  width: number,
  height: number
): Point[] {
  return indices.map((i) => {
    const p = landmarks[i];
    return { x: p.x * width, y: p.y * height };
  });
}
