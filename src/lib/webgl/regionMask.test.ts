import { describe, expect, it } from "vitest";
import { sideOfLine } from "./regionMask";

describe("sideOfLine", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 0, y: 10 }; // vertical line x=0

  it("classifies points on opposite sides with opposite signs", () => {
    expect(Math.sign(sideOfLine({ x: 5, y: 5 }, a, b))).toBe(
      -Math.sign(sideOfLine({ x: -5, y: 5 }, a, b))
    );
  });

  it("returns 0 on the line", () => {
    expect(sideOfLine({ x: 0, y: 3 }, a, b)).toBe(0);
  });
});
