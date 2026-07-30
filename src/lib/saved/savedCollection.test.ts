import { describe, expect, it } from "vitest";
import {
  emptySaved,
  isProductSaved,
  toggleProduct,
  addLook,
  deleteLook,
  migrateSaved,
  type SavedLook,
} from "./savedCollection";
import type { CatalogProduct } from "@/lib/catalog/types";

function makeProduct(id: string): CatalogProduct {
  return {
    id,
    category: "LIPSTICK",
    name: `Product ${id}`,
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

function makeLook(id: string): SavedLook {
  return {
    id,
    name: `Look ${id}`,
    layers: [
      { category: "LIPSTICK", product: makeProduct("p1"), opacity: 1, visible: true },
    ],
    createdAt: "2026-07-19T00:00:00.000Z",
  };
}

describe("saved products", () => {
  it("starts empty", () => {
    expect(emptySaved()).toEqual({ products: [], looks: [] });
  });

  it("toggles a product in (newest first) and back out", () => {
    const a = makeProduct("1");
    const b = makeProduct("2");
    let state = toggleProduct(emptySaved(), a);
    state = toggleProduct(state, b);
    expect(state.products.map((p) => p.id)).toEqual(["2", "1"]);
    expect(isProductSaved(state, "1")).toBe(true);

    state = toggleProduct(state, a);
    expect(state.products.map((p) => p.id)).toEqual(["2"]);
    expect(isProductSaved(state, "1")).toBe(false);
  });
});

describe("saved looks", () => {
  it("prepends a look and deep-copies its layers (no aliasing)", () => {
    const look = makeLook("L1");
    const state = addLook(emptySaved(), look);
    expect(state.looks.map((l) => l.id)).toEqual(["L1"]);
    expect(state.looks[0].layers[0]).not.toBe(look.layers[0]);
    // Mutating the source layer must not affect the saved copy.
    look.layers[0].opacity = 0.1;
    expect(state.looks[0].layers[0].opacity).toBe(1);
  });

  it("deletes a look by id", () => {
    let state = addLook(emptySaved(), makeLook("L1"));
    state = addLook(state, makeLook("L2"));
    state = deleteLook(state, "L1");
    expect(state.looks.map((l) => l.id)).toEqual(["L2"]);
  });
});

describe("migrateSaved", () => {
  it("passes through a valid payload", () => {
    const valid = { products: [makeProduct("1")], looks: [makeLook("L1")] };
    expect(migrateSaved(valid)).toEqual(valid);
  });

  it("drops malformed products and looks", () => {
    const messy = {
      products: [makeProduct("1"), { nope: true }, null],
      looks: [makeLook("L1"), { id: "x" }, 42],
    };
    const out = migrateSaved(messy);
    expect(out.products.map((p) => p.id)).toEqual(["1"]);
    expect(out.looks.map((l) => l.id)).toEqual(["L1"]);
  });

  it("falls back to empty on garbage", () => {
    expect(migrateSaved(null)).toEqual({ products: [], looks: [] });
    expect(migrateSaved("nope")).toEqual({ products: [], looks: [] });
    expect(migrateSaved({})).toEqual({ products: [], looks: [] });
  });
});
