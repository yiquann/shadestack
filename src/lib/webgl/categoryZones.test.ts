import { describe, expect, it } from "vitest";
import { CATEGORY_RENDER } from "./categoryZones";
import { CATEGORIES } from "@/lib/catalog/types";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";

describe("CATEGORY_RENDER", () => {
  it("has an entry for every catalog category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_RENDER[category]).toBeDefined();
    }
  });

  it("only references zones that exist in ZONE_LANDMARKS", () => {
    for (const category of CATEGORIES) {
      for (const entry of CATEGORY_RENDER[category].entries) {
        expect(ZONE_LANDMARKS[entry.zone]).toBeDefined();
      }
    }
  });

  it("matches the CLAUDE.md Rendering Fidelity Targets baseline values", () => {
    expect(CATEGORY_RENDER.FOUNDATION).toEqual({
      entries: [{ zone: "faceOval", featherPx: 8 }],
      blendMode: "multiply",
      baseOpacity: 0.18,
      smooth: "coverage",
    });
    expect(CATEGORY_RENDER.SETTING_POWDER).toEqual({
      entries: [{ zone: "faceOval", featherPx: 8 }],
      blendMode: "multiply",
      baseOpacity: 0.06,
      smooth: "none",
    });
    expect(CATEGORY_RENDER.BRONZER).toEqual({
      entries: [
        { zone: "leftCheekbone", featherPx: 14 },
        { zone: "rightCheekbone", featherPx: 14 },
        { zone: "leftTemple", featherPx: 12 },
        { zone: "rightTemple", featherPx: 12 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.18,
      smooth: "light",
    });
    expect(CATEGORY_RENDER.BLUSH).toEqual({
      entries: [
        { zone: "leftCheek", featherPx: 12 },
        { zone: "rightCheek", featherPx: 12 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.32,
      smooth: "light",
    });
    expect(CATEGORY_RENDER.HIGHLIGHTER).toEqual({
      entries: [
        { zone: "leftCheek", featherPx: 10 },
        { zone: "rightCheek", featherPx: 10 },
      ],
      blendMode: "screen",
      baseOpacity: 0.25,
      smooth: "none",
    });
    expect(CATEGORY_RENDER.EYESHADOW).toEqual({
      entries: [
        { zone: "leftEye", featherPx: 9 },
        { zone: "rightEye", featherPx: 9 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.32,
      smooth: "none",
    });
    expect(CATEGORY_RENDER.LIPSTICK).toEqual({
      entries: [{ zone: "lips", featherPx: 2 }],
      blendMode: "multiply",
      baseOpacity: 0.55,
      smooth: "none",
    });
  });
});
