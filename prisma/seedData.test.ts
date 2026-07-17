import { describe, expect, it } from "vitest";
import { seedProducts } from "./seedData";

const CATEGORIES = [
  "FOUNDATION",
  "BLUSH",
  "BRONZER",
  "HIGHLIGHTER",
  "EYESHADOW",
  "LIPSTICK",
  "SETTING_POWDER",
] as const;

describe("seedProducts", () => {
  it("has at least 3 products per category", () => {
    for (const category of CATEGORIES) {
      const count = seedProducts.filter((p) => p.category === category).length;
      expect(count, `${category} should have >= 3 products`).toBeGreaterThanOrEqual(3);
    }
  });

  it("has at least 18 products total", () => {
    expect(seedProducts.length).toBeGreaterThanOrEqual(18);
  });

  it("every product has a valid 6-digit hex colorHex", () => {
    for (const p of seedProducts) {
      expect(p.colorHex, `${p.name} colorHex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("every product has a positive price", () => {
    for (const p of seedProducts) {
      expect(p.price, `${p.name} price`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate name+brand+shade combinations", () => {
    const keys = seedProducts.map((p) => `${p.brand}|${p.name}|${p.shade}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
