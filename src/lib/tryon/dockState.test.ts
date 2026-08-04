import { describe, expect, it } from "vitest";
import {
  dockActions,
  entryHighlight,
  hasAnyProducts,
  lookSlots,
  primaryLook,
} from "./dockState";
import type { AppliedLayer, Looks } from "./session";

const layer = (category: AppliedLayer["category"]): AppliedLayer => ({
  category,
  product: {
    id: `p-${category}`,
    category,
    name: "Test",
    brand: "Test",
    shade: "01",
    colorHex: "#C4916C",
    price: 20,
    coverage: "Medium",
    finish: "Matte",
    skinType: "All skin types",
    desc: "",
  },
  opacity: 1,
  visible: true,
});

const looks = (a: boolean, b: boolean): Looks => ({
  A: a ? [layer("LIPSTICK")] : [],
  B: b ? [layer("BLUSH")] : [],
});

describe("primaryLook", () => {
  it("is A when only Look A has products", () => {
    expect(primaryLook(looks(true, false))).toBe("A");
  });

  it("is B when only Look B has products", () => {
    // Reachable by opening split before adding anything, or by clearing A.
    expect(primaryLook(looks(false, true))).toBe("B");
  });

  it("prefers A when both have products", () => {
    expect(primaryLook(looks(true, true))).toBe("A");
  });

  it("falls back to A when neither has products", () => {
    expect(primaryLook(looks(false, false))).toBe("A");
  });
});

describe("hasAnyProducts", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])("A=%s B=%s -> %s", (a, b, expected) => {
    expect(hasAnyProducts(looks(a, b))).toBe(expected);
  });
});

describe("dockActions", () => {
  it("disables swap in single view regardless of products", () => {
    expect(dockActions("single", looks(true, true)).swap).toBe(false);
    expect(dockActions("single", looks(false, false)).swap).toBe(false);
  });

  it("enables swap in split view regardless of products", () => {
    expect(dockActions("split", looks(false, false)).swap).toBe(true);
  });

  it("disables orientation and save when nothing is applied", () => {
    for (const mode of ["single", "split"] as const) {
      const actions = dockActions(mode, looks(false, false));
      expect(actions.orientation).toBe(false);
      expect(actions.save).toBe(false);
    }
  });

  it("enables orientation and save from a populated Look B alone, in both modes", () => {
    // The case the one-rule-for-both-modes design exists for: single view
    // renders Look B here, so the controls must not be dead.
    for (const mode of ["single", "split"] as const) {
      const actions = dockActions(mode, looks(false, true));
      expect(actions.orientation).toBe(true);
      expect(actions.save).toBe(true);
    }
  });
});

describe("entryHighlight", () => {
  it("flags the sole populated look — the half that will have makeup", () => {
    expect(entryHighlight(looks(true, false))).toBe("A");
    expect(entryHighlight(looks(false, true))).toBe("B");
  });

  it("stays silent when both are populated — nothing was assigned", () => {
    // Both halves come up at once; a highlight would imply something moved.
    expect(entryHighlight(looks(true, true))).toBeNull();
  });

  it("stays silent when nothing is applied", () => {
    expect(entryHighlight(looks(false, false))).toBeNull();
  });
});

describe("lookSlots", () => {
  it("shows both looks live in split, in face order", () => {
    expect(lookSlots("split", looks(false, false), false)).toEqual([
      { look: "A", label: "Look A", live: true },
      { look: "B", label: "Look B", live: true },
    ]);
  });

  it("exchanges the chip contents when swapped, so position tracks the half", () => {
    expect(lookSlots("split", looks(true, true), true)).toEqual([
      { look: "B", label: "Look B", live: true },
      { look: "A", label: "Look A", live: true },
    ]);
  });

  it("shows one chip labelled Look when single view has at most one look", () => {
    for (const [a, b, target] of [
      [false, false, "A"],
      [true, false, "A"],
      [false, true, "B"],
    ] as const) {
      expect(lookSlots("single", looks(a, b), false)).toEqual([
        { look: target, label: "Look", live: true },
      ]);
    }
  });

  it("keeps a populated Look B on screen in single view, dimmed", () => {
    expect(lookSlots("single", looks(true, true), false)).toEqual([
      { look: "A", label: "Look A", live: true },
      { look: "B", label: "Look B", live: false },
    ]);
  });

  it("ignores swapped in single view — swapping is a split-only action", () => {
    expect(lookSlots("single", looks(true, true), true)).toEqual(
      lookSlots("single", looks(true, true), false)
    );
  });

  it("never renders a product count", () => {
    for (const mode of ["single", "split"] as const) {
      for (const slot of lookSlots(mode, looks(true, true), false)) {
        expect(slot.label).toMatch(/^Look( [AB])?$/);
      }
    }
  });
});
