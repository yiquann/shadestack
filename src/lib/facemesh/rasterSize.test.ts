import { describe, expect, it } from "vitest";
import { rasterSize } from "./rasterSize";

describe("rasterSize", () => {
  it("leaves the model SVG untouched, preserving its natural-size rasterization", () => {
    // 500x600 is well under the cap; the documented fix for the shrunken
    // upper-left face depends on this staying at natural size.
    expect(rasterSize(500, 600, 1080)).toEqual({ width: 500, height: 600 });
  });

  it("caps a 12MP phone selfie's long edge", () => {
    const { width, height } = rasterSize(4032, 3024, 1080);
    expect(Math.max(width, height)).toBe(1080);
  });

  it("cuts the pixel count of a 12MP selfie by an order of magnitude", () => {
    const { width, height } = rasterSize(4032, 3024, 1080);
    expect(width * height).toBeLessThan((4032 * 3024) / 10);
  });

  it("preserves aspect ratio when downscaling", () => {
    const { width, height } = rasterSize(4032, 3024, 1080);
    expect(width / height).toBeCloseTo(4032 / 3024, 2);
  });

  it("caps the long edge for portrait sources too", () => {
    const { width, height } = rasterSize(3024, 4032, 1080);
    expect(height).toBe(1080);
    expect(width).toBeLessThan(height);
  });

  it("never upscales a small source", () => {
    expect(rasterSize(100, 80, 1080)).toEqual({ width: 100, height: 80 });
  });

  it("degrades safely on nonsense dimensions", () => {
    expect(rasterSize(0, 0, 1080)).toEqual({ width: 1, height: 1 });
    expect(rasterSize(NaN, NaN, 1080)).toEqual({ width: 1, height: 1 });
  });
});
