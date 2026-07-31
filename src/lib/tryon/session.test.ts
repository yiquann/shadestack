import { describe, expect, it } from "vitest";
import {
  applyProduct,
  removeLayer,
  setOpacity,
  toggleVisible,
  moveLayer,
  clearLook,
  emptyLooks,
  migrateStoredSession,
  restorableSource,
} from "./session";
import type { CatalogProduct } from "@/lib/catalog/types";

function makeProduct(category: CatalogProduct["category"], id: string): CatalogProduct {
  return {
    id,
    category,
    name: `${category} product ${id}`,
    brand: "Brand",
    shade: "Shade",
    colorHex: "#AABBCC",
    price: 20,
    coverage: "Medium",
    finish: "Matte",
    skinType: "All skin types",
    desc: "desc",
  };
}

describe("applyProduct", () => {
  it("inserts a new category at its default z-order position among existing layers", () => {
    const blush = makeProduct("BLUSH", "1");
    const lipstick = makeProduct("LIPSTICK", "2");
    let layers = applyProduct([], blush);
    layers = applyProduct(layers, lipstick);
    expect(layers.map((l) => l.category)).toEqual(["BLUSH", "LIPSTICK"]);

    const bronzer = makeProduct("BRONZER", "3");
    layers = applyProduct(layers, bronzer);
    expect(layers.map((l) => l.category)).toEqual(["BRONZER", "BLUSH", "LIPSTICK"]);
  });

  it("appends when the new category ranks after everything already present", () => {
    const foundation = makeProduct("FOUNDATION", "1");
    const lipstick = makeProduct("LIPSTICK", "2");
    let layers = applyProduct([], foundation);
    layers = applyProduct(layers, lipstick);
    expect(layers.map((l) => l.category)).toEqual(["FOUNDATION", "LIPSTICK"]);
  });

  it("replaces the product in place for an already-applied category, preserving opacity and visibility", () => {
    const blushA = makeProduct("BLUSH", "1");
    const blushB = makeProduct("BLUSH", "2");
    let layers = applyProduct([], blushA);
    layers = setOpacity(layers, "BLUSH", 0.5);
    layers = toggleVisible(layers, "BLUSH");
    layers = applyProduct(layers, blushB);
    expect(layers).toEqual([{ category: "BLUSH", product: blushB, opacity: 0.5, visible: false }]);
  });

  it("gives a brand-new layer full opacity and visibility by default", () => {
    const product = makeProduct("LIPSTICK", "1");
    const layers = applyProduct([], product);
    expect(layers).toEqual([{ category: "LIPSTICK", product, opacity: 1, visible: true }]);
  });
});

describe("removeLayer", () => {
  it("removes the layer for the given category and leaves others untouched", () => {
    let layers = applyProduct([], makeProduct("BLUSH", "1"));
    layers = applyProduct(layers, makeProduct("LIPSTICK", "2"));
    layers = removeLayer(layers, "BLUSH");
    expect(layers.map((l) => l.category)).toEqual(["LIPSTICK"]);
  });

  it("is a no-op when the category isn't present", () => {
    const layers = applyProduct([], makeProduct("BLUSH", "1"));
    expect(removeLayer(layers, "LIPSTICK")).toEqual(layers);
  });
});

describe("setOpacity", () => {
  it("sets the opacity for the matching category", () => {
    const layers = applyProduct([], makeProduct("BLUSH", "1"));
    expect(setOpacity(layers, "BLUSH", 0.4)[0].opacity).toBe(0.4);
  });

  it("clamps values below 0 and above 1", () => {
    const layers = applyProduct([], makeProduct("BLUSH", "1"));
    expect(setOpacity(layers, "BLUSH", -0.5)[0].opacity).toBe(0);
    expect(setOpacity(layers, "BLUSH", 1.5)[0].opacity).toBe(1);
  });
});

describe("toggleVisible", () => {
  it("flips visibility for the matching category", () => {
    const layers = applyProduct([], makeProduct("BLUSH", "1"));
    expect(toggleVisible(layers, "BLUSH")[0].visible).toBe(false);
    expect(toggleVisible(toggleVisible(layers, "BLUSH"), "BLUSH")[0].visible).toBe(true);
  });
});

describe("moveLayer", () => {
  it("moves a layer to sit at another layer's index", () => {
    let layers = applyProduct([], makeProduct("FOUNDATION", "1"));
    layers = applyProduct(layers, makeProduct("BLUSH", "2"));
    layers = applyProduct(layers, makeProduct("LIPSTICK", "3"));
    expect(layers.map((l) => l.category)).toEqual(["FOUNDATION", "BLUSH", "LIPSTICK"]);

    layers = moveLayer(layers, "LIPSTICK", "FOUNDATION");
    expect(layers.map((l) => l.category)).toEqual(["LIPSTICK", "FOUNDATION", "BLUSH"]);
  });

  it("is a no-op when either category is missing or they're the same", () => {
    const layers = applyProduct([], makeProduct("BLUSH", "1"));
    expect(moveLayer(layers, "BLUSH", "BLUSH")).toEqual(layers);
    expect(moveLayer(layers, "BLUSH", "LIPSTICK")).toEqual(layers);
    expect(moveLayer(layers, "LIPSTICK", "BLUSH")).toEqual(layers);
  });
});

describe("clearLook", () => {
  it("returns an empty array", () => {
    expect(clearLook()).toEqual([]);
  });
});

function fakeLayer(category: CatalogProduct["category"]) {
  return { category, product: { category } as CatalogProduct, opacity: 1, visible: true };
}

describe("two-look model", () => {
  it("emptyLooks starts both looks empty", () => {
    expect(emptyLooks()).toEqual({ A: [], B: [] });
  });

  it("migrateStoredSession upgrades a v1 bare-array payload into looks.A/single", () => {
    const v1 = [fakeLayer("FOUNDATION")];
    expect(migrateStoredSession(v1)).toEqual({ looks: { A: v1, B: [] }, mode: "single" });
  });

  it("migrateStoredSession passes through a v2 payload", () => {
    const v2 = { looks: { A: [], B: [fakeLayer("BLUSH")] }, mode: "split" as const };
    expect(migrateStoredSession(v2)).toEqual(v2);
  });

  it("migrateStoredSession falls back to empty on garbage", () => {
    expect(migrateStoredSession(null)).toEqual({ looks: { A: [], B: [] }, mode: "single" });
    expect(migrateStoredSession({ nope: 1 })).toEqual({ looks: { A: [], B: [] }, mode: "single" });
  });
});

describe("restorableSource", () => {
  it("restores photo, so an unrequested reload does not strand the user on Model", () => {
    // The iOS Photos picker can get the tab discarded and reloaded; without
    // this the user silently landed back on the illustrated model face.
    expect(restorableSource("photo")).toBe("photo");
  });

  it("restores model", () => {
    expect(restorableSource("model")).toBe("model");
  });

  it("downgrades camera to model so a reload never re-prompts for permission", () => {
    expect(restorableSource("camera")).toBe("model");
  });

  it("falls back to model on absent or malformed values", () => {
    expect(restorableSource(null)).toBe("model");
    expect(restorableSource(undefined)).toBe("model");
    expect(restorableSource("")).toBe("model");
    expect(restorableSource("nonsense")).toBe("model");
    expect(restorableSource({ source: "photo" })).toBe("model");
  });
});
