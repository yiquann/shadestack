import { describe, expect, it } from "vitest";
import { skinMaskData, FACE_SKIN_CATEGORY } from "./skinMask";

describe("skinMaskData", () => {
  it("marks only face-skin pixels opaque, rest transparent, RGB white", () => {
    // 2x2: [background, face-skin, hair, face-skin]
    const cats = new Uint8Array([0, FACE_SKIN_CATEGORY, 1, FACE_SKIN_CATEGORY]);
    const rgba = skinMaskData(cats, 2, 2);
    expect(rgba).toHaveLength(2 * 2 * 4);
    expect(rgba[3]).toBe(0); // px0 background -> transparent
    expect(rgba[7]).toBe(255); // px1 face-skin -> opaque
    expect(rgba[11]).toBe(0); // px2 hair -> transparent
    expect(rgba[15]).toBe(255); // px3 face-skin -> opaque
    // color channels are white for opaque skin pixels
    expect([rgba[4], rgba[5], rgba[6]]).toEqual([255, 255, 255]);
  });

  it("FACE_SKIN_CATEGORY is 3 (selfie multiclass face-skin index)", () => {
    expect(FACE_SKIN_CATEGORY).toBe(3);
  });
});
