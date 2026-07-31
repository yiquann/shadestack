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
  // `baseOpacity` is the ceiling, not a fixed value: the per-layer slider scales
  // 0..100% onto 0..baseOpacity, so these are what 100% looks like.
  //
  // Blush and bronzer sit well above the prototype's original 0.32 / 0.18
  // because a multiply blend resolves to `dst * (1 - a*(1 - colour))` — the
  // effect scales with how far the pigment sits from white, and cosmetic
  // swatches are pale. At 0.32 a blush like #E8A0A0 moved the red channel by
  // 6/255, so even a maxed-out slider barely registered on skin.
  //
  // Blush's 0.7 exceeding lipstick's 0.55 is not an inconsistency: lipstick
  // swatches are far darker, so their (1 - colour) term is much larger and 0.55
  // there lands heavier than 0.7 does on a pale pink.
  BRONZER: {
    entries: [
      { zone: "leftCheekbone", featherPx: 14 },
      { zone: "rightCheekbone", featherPx: 14 },
      { zone: "leftTemple", featherPx: 12 },
      { zone: "rightTemple", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.48,
    smooth: "light",
  },
  BLUSH: {
    entries: [
      { zone: "leftCheek", featherPx: 12 },
      { zone: "rightCheek", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.7,
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
