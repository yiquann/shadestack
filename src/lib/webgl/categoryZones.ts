import type { CatalogProduct } from "@/lib/catalog/types";
import type { ZoneName } from "@/lib/facemesh/zones";
import type { BlendMode } from "./compositor";

export type CategoryZoneEntry = { zone: ZoneName; featherPx: number };

export type CategoryRenderConfig = {
  entries: CategoryZoneEntry[];
  blendMode: BlendMode;
  baseOpacity: number;
  smooth: "coverage" | "light" | "none";
};

// Foundation coverage -> { skin-blur strength, tint opacity }. Blush/bronzer use
// the "light" blur strength only (their pigment stays their own baseOpacity).
export const COVERAGE_SMOOTHING: Record<string, { blur: number; tint: number }> = {
  light: { blur: 0.12, tint: 0.15 },
  medium: { blur: 0.22, tint: 0.18 },
  buildable: { blur: 0.28, tint: 0.2 },
  full: { blur: 0.4, tint: 0.22 },
};

export function normalizeCoverage(coverage: string): string {
  return coverage.trim().toLowerCase();
}

export const CATEGORY_RENDER: Record<CatalogProduct["category"], CategoryRenderConfig> = {
  FOUNDATION: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.18,
    smooth: "coverage",
  },
  SETTING_POWDER: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.06,
    smooth: "none",
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
    smooth: "light",
  },
  BLUSH: {
    entries: [
      { zone: "leftCheek", featherPx: 12 },
      { zone: "rightCheek", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
    smooth: "light",
  },
  HIGHLIGHTER: {
    entries: [
      { zone: "leftCheek", featherPx: 10 },
      { zone: "rightCheek", featherPx: 10 },
    ],
    blendMode: "screen",
    baseOpacity: 0.25,
    smooth: "none",
  },
  EYESHADOW: {
    entries: [
      { zone: "leftEye", featherPx: 9 },
      { zone: "rightEye", featherPx: 9 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
    smooth: "none",
  },
  LIPSTICK: {
    entries: [{ zone: "lips", featherPx: 2 }],
    blendMode: "multiply",
    baseOpacity: 0.55,
    smooth: "none",
  },
};
