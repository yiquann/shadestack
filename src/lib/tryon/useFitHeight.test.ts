import { describe, expect, it } from "vitest";
import { fitWidth } from "./useFitHeight";

describe("fitWidth", () => {
  it("derives width from the available height so the ratio is preserved", () => {
    // 400px of room at 5:6 -> 333.33px wide, which is 400 * 5/6.
    expect(fitWidth(400, 5, 6)).toBe(`min(100%, ${(400 * 5) / 6}px)`);
  });

  it("caps at the column width so a wide source cannot overflow horizontally", () => {
    // The min(100%, ...) wrapper is what enforces this; a landscape source
    // asks for more width than the column has.
    expect(fitWidth(400, 16, 9)).toContain("min(100%,");
  });

  it("falls back to full width before the first measurement", () => {
    expect(fitWidth(null, 5, 6)).toBe("100%");
  });

  it("falls back to full width for degenerate sizes", () => {
    expect(fitWidth(0, 5, 6)).toBe("100%");
    expect(fitWidth(-10, 5, 6)).toBe("100%");
    expect(fitWidth(400, 5, 0)).toBe("100%");
  });

  it("gives a taller source a narrower box for the same available height", () => {
    const portrait = fitWidth(400, 3, 4);
    const squarer = fitWidth(400, 1, 1);
    const px = (s: string) => Number(s.match(/([\d.]+)px/)![1]);
    expect(px(portrait)).toBeLessThan(px(squarer));
  });
});
