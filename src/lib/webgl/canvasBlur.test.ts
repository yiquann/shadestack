import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canvasFilterSupported,
  resetCanvasFilterSupport,
  shadowBlurForRadius,
  shadowOffsetForRadius,
} from "./canvasBlur";

afterEach(() => {
  resetCanvasFilterSupport();
  vi.unstubAllGlobals();
});

describe("shadowBlurForRadius", () => {
  // A shadow's Gaussian uses stdDev = shadowBlur/2; filter: blur(r) uses
  // stdDev = r. The fallback must double the radius or it blurs half as much.
  it("doubles the radius so the shadow matches an equivalent filter blur", () => {
    expect(shadowBlurForRadius(3)).toBe(6);
    expect(shadowBlurForRadius(0)).toBe(0);
  });
});

describe("shadowOffsetForRadius", () => {
  it("pushes the source clear of the canvas and its own blur spread", () => {
    // Anything less would leave part of the un-blurred source visible.
    expect(shadowOffsetForRadius(256, 8)).toBeGreaterThan(256 + 8);
  });

  it("scales with both canvas width and blur radius", () => {
    expect(shadowOffsetForRadius(512, 4)).toBeGreaterThan(shadowOffsetForRadius(256, 4));
    expect(shadowOffsetForRadius(256, 40)).toBeGreaterThan(shadowOffsetForRadius(256, 4));
  });
});

describe("canvasFilterSupported", () => {
  it("is false when there is no document (SSR)", () => {
    expect(canvasFilterSupported()).toBe(false);
  });

  it("is false when the prototype lacks `filter`, even if an instance expando reads back", () => {
    // WebKit's actual failure mode: assigning ctx.filter on a platform object
    // that does not implement it creates a same-valued own property, so a naive
    // round-trip check reports support that is not there.
    const ctx: Record<string, unknown> = {};
    stubCanvas(ctx, { prototypeHasFilter: false });
    expect(canvasFilterSupported()).toBe(false);
  });

  it("is false when `filter` exists but does not actually blur", () => {
    const ctx = blurringCtx(false);
    stubCanvas(ctx, { prototypeHasFilter: true });
    expect(canvasFilterSupported()).toBe(false);
  });

  it("is true when `filter` exists and bleeds alpha past the fill edge", () => {
    const ctx = blurringCtx(true);
    stubCanvas(ctx, { prototypeHasFilter: true });
    expect(canvasFilterSupported()).toBe(true);
  });

  it("caches the result across calls", () => {
    const ctx = blurringCtx(true);
    const { getContext } = stubCanvas(ctx, { prototypeHasFilter: true });
    canvasFilterSupported();
    canvasFilterSupported();
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});

/** A fake 2D context whose probe pixel reports bleed only if `blurs`. */
function blurringCtx(blurs: boolean): Record<string, unknown> {
  return {
    filter: "none",
    fillStyle: "",
    fillRect: () => {},
    getImageData: () => ({ data: [0, 0, 0, blurs ? 128 : 0] }),
  };
}

function stubCanvas(
  ctx: Record<string, unknown>,
  { prototypeHasFilter }: { prototypeHasFilter: boolean }
) {
  const getContext = vi.fn(() => ctx);
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext }),
  });
  vi.stubGlobal("CanvasRenderingContext2D", {
    prototype: prototypeHasFilter ? { filter: "none" } : {},
  });
  return { getContext };
}
