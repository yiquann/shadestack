import type { CatalogProduct } from "@/lib/catalog/types";
import type { ZoneName } from "@/lib/facemesh/zones";
import type { BlendMode } from "./compositor";

export type CategoryZoneEntry = { zone: ZoneName; featherPx: number };

export type CategoryRenderConfig = {
  entries: CategoryZoneEntry[];
  blendMode: BlendMode;
  baseOpacity: number;
};

export const CATEGORY_RENDER: Record<CatalogProduct["category"], CategoryRenderConfig> = {
  FOUNDATION: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.18,
  },
  SETTING_POWDER: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.06,
  },
  BRONZER: {
    entries: [
      { zone: "leftCheekbone", featherPx: 14 },
      { zone: "rightCheekbone", featherPx: 14 },
      { zone: "leftTemple", featherPx: 12 },
      { zone: "rightTemple", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.18,
  },
  BLUSH: {
    entries: [
      { zone: "leftCheek", featherPx: 12 },
      { zone: "rightCheek", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
  },
  HIGHLIGHTER: {
    entries: [
      { zone: "leftCheek", featherPx: 10 },
      { zone: "rightCheek", featherPx: 10 },
    ],
    blendMode: "screen",
    baseOpacity: 0.25,
  },
  EYESHADOW: {
    entries: [
      { zone: "leftEye", featherPx: 3 },
      { zone: "rightEye", featherPx: 3 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
  },
  LIPSTICK: {
    entries: [{ zone: "lips", featherPx: 2 }],
    blendMode: "multiply",
    baseOpacity: 0.55,
  },
};
