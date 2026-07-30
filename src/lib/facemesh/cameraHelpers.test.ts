import { describe, expect, it } from "vitest";
import { nextFacingMode, detectionInterval } from "./cameraHelpers";

describe("nextFacingMode", () => {
  it("toggles user -> environment", () => {
    expect(nextFacingMode("user")).toBe("environment");
  });
  it("toggles environment -> user", () => {
    expect(nextFacingMode("environment")).toBe("user");
  });
});

describe("detectionInterval", () => {
  it("detects every frame in the ~30-45fps band", () => {
    expect(detectionInterval(1000 / 30)).toBe(1);
    expect(detectionInterval(1000 / 40)).toBe(1);
  });
  it("detects every other frame above ~45fps so the draw loop can reach 60", () => {
    expect(detectionInterval(1000 / 60)).toBe(2);
    expect(detectionInterval(1000 / 50)).toBe(2);
  });
  it("halves detection cadence when between 24 and 30fps", () => {
    expect(detectionInterval(1000 / 27)).toBe(2);
  });
  it("stays at every-other-frame under 24fps (never drops resolution here)", () => {
    expect(detectionInterval(1000 / 15)).toBe(2);
  });
  it("never returns zero for absurd inputs", () => {
    expect(detectionInterval(0)).toBe(1);
    expect(detectionInterval(Number.NaN)).toBe(1);
  });
});
