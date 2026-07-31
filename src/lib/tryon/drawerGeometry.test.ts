import { describe, expect, it } from "vitest";
import { computeDrawerGeometry, resolveDrag, MIN_DRAWER_HEIGHT } from "./drawerGeometry";

describe("computeDrawerGeometry", () => {
  it("uses the four-row minimum when half the screen would be shorter", () => {
    // Half of 800 is 400, under the 478px needed for four rows plus chrome.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 800, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 0, height: MIN_DRAWER_HEIGHT, hasScrim: true });
  });

  it("prefers half the screen once that exceeds the four-row minimum", () => {
    // Half of 1200 is 600, comfortably past the minimum, so the fraction wins.
    expect(
      computeDrawerGeometry({ innerHeight: 1200, viewportHeight: 1200, viewportOffsetTop: 0 })
        .height
    ).toBe(600);
  });

  it("shows at least four product rows plus the chrome above them", () => {
    const { height } = computeDrawerGeometry({
      innerHeight: 800,
      viewportHeight: 800,
      viewportOffsetTop: 0,
    });
    // 24px gripper + 54px search block + 24px "Adding to Look B" caption.
    const listHeight = height - (24 + 54 + 24);
    expect(listHeight / 94).toBeGreaterThanOrEqual(4);
  });

  it("lifts the panel by the keyboard height, keeping its height", () => {
    // A 300px keyboard leaves 500px visible — still roomier than the panel.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 300, height: MIN_DRAWER_HEIGHT, hasScrim: true });
  });

  it("clamps to the visible viewport and drops the scrim under a tall keyboard", () => {
    // A 500px keyboard leaves 300px visible — less than the panel wants, so it
    // fills the visible area and no space is left above it to tap.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 300, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 500, height: 300, hasScrim: false });
  });

  it("subtracts the visual viewport offset when pinch-zoom has scrolled it", () => {
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 120 })
        .bottomInset
    ).toBe(180);
  });

  it("never returns a negative inset", () => {
    // Some browsers briefly over-report visualViewport.height mid keyboard animation.
    expect(
      computeDrawerGeometry({ innerHeight: 800, viewportHeight: 900, viewportOffsetTop: 0 })
        .bottomInset
    ).toBe(0);
  });

  it("still fits four rows on a short screen when visualViewport is unavailable", () => {
    // The hook passes innerHeight for both measurements in that case. Half of
    // 640 is only 320px — roughly three rows — so the minimum takes over.
    expect(
      computeDrawerGeometry({ innerHeight: 640, viewportHeight: 640, viewportOffsetTop: 0 })
    ).toEqual({ bottomInset: 0, height: MIN_DRAWER_HEIGHT, hasScrim: true });
  });
});

describe("resolveDrag", () => {
  it("closes when dragged past a quarter of the panel height", () => {
    expect(resolveDrag({ deltaY: 101, height: 400, velocity: 0 })).toBe("close");
  });

  it("snaps back just short of the distance threshold", () => {
    expect(resolveDrag({ deltaY: 99, height: 400, velocity: 0 })).toBe("snap-back");
  });

  it("closes on a fast flick that never reached the distance threshold", () => {
    expect(resolveDrag({ deltaY: 30, height: 400, velocity: 1.2 })).toBe("close");
  });

  it("snaps back on a slow, short drag", () => {
    expect(resolveDrag({ deltaY: 30, height: 400, velocity: 0.1 })).toBe("snap-back");
  });

  it("snaps back when dragged upward, however fast", () => {
    expect(resolveDrag({ deltaY: -80, height: 400, velocity: 2 })).toBe("snap-back");
  });
});
