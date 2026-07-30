# Phase 5: Active Layers Panel + Add Products Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 4's hardcoded demo layers with a real, client-side try-on session:
users add real catalog products (from Discover or a new in-tab Add Products section), see
them rendered live via the Phase 4 WebGL pipeline, and can toggle visibility, adjust
per-layer opacity, drag-reorder the stack, remove a layer, and clear the whole look —
persisted across reloads via `localStorage`.

**Architecture:** A `TryOnSessionProvider` (React Context, `localStorage`-backed) wraps the
`(tabs)` layout and holds an ordered `AppliedLayer[]` (bottom-to-top paint order). Pure
state-transition functions live in `src/lib/tryon/session.ts`, independently unit-testable.
A new `src/lib/webgl/categoryZones.ts` maps each catalog category to its zone(s), blend
mode, and baseline opacity (the exact values Phase 4 already validated visually), replacing
`RenderCanvas`'s hardcoded demo array. `LayerPanel`/`LayerRow` (drag via `@dnd-kit`) render
and mutate the session; an `AddProductsSection` (reusing Discover's catalog components)
lets users add products without leaving the tab; `ProductCard`'s and `ProductDetailSheet`'s
existing "Try On" buttons call into the session too.

**Tech Stack:** React Context + `localStorage` (no new state library), `@dnd-kit/core` +
`@dnd-kit/sortable` + `@dnd-kit/utilities` for drag-to-reorder, Vitest for the pure
session/config logic, Playwright for the interactive/render verification (same pattern as
Phases 3–4).

## Global Constraints

- Session ordering convention: `layers[0]` is the bottom of the visual stack, the last
  element is the top (CLAUDE.md: "bottom = foundation, top = lipstick by default"). The
  `LayerPanel` UI displays the array reversed (top-of-stack first).
- Default z-order for inserting a genuinely new category:
  `FOUNDATION < SETTING_POWDER < BRONZER < BLUSH < HIGHLIGHTER < EYESHADOW < LIPSTICK`.
- Replacing an already-applied category's product keeps that layer's array position,
  `opacity`, and `visible` — only `product` changes.
- `localStorage` key is exactly `"shadestack.tryon.session.v1"`. All reads/writes are
  wrapped in `try/catch`; any failure (missing key, corrupt JSON, quota, unavailable API)
  falls back to an empty session in memory — it must never throw.
- `CATEGORY_RENDER` values (zones/blend/opacity/feather) are copied verbatim from Phase 4's
  already-shipped, visually-verified values — do not invent new numbers:

  | Category | Zone draws (zone, featherPx) | Blend | Base opacity |
  |---|---|---|---|
  | `FOUNDATION` | `faceOval`, 8 | multiply | 0.18 |
  | `SETTING_POWDER` | `faceOval`, 8 | multiply | 0.06 |
  | `BRONZER` | `forehead`, 14 + `jawline`, 14 | multiply | 0.18 |
  | `BLUSH` | `leftCheek`, 12 + `rightCheek`, 12 | multiply | 0.32 |
  | `HIGHLIGHTER` | `leftCheek`, 10 + `rightCheek`, 10 | screen | 0.25 |
  | `EYESHADOW` | `leftEye`, 3 + `rightEye`, 3 | multiply | 0.32 |
  | `LIPSTICK` | `lips`, 2 | multiply | 0.55 |

- New dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — no other
  new runtime dependency.
- TypeScript strict mode; no `any` in the render pipeline (`RenderCanvas`, `categoryZones.ts`
  qualify — CLAUDE.md Conventions).
- Colors/spacing in component chrome only via design tokens; a product's `colorHex` is
  per-product data, not a design-system palette value (same established exception as prior
  phases).
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`).
- Out of scope: the "Complete Your Look" complementary-category suggestion carousel — do not
  build it in this plan.

---

### Task 1: Session state — pure functions

**Files:**
- Create: `src/lib/tryon/session.ts`
- Test: `src/lib/tryon/session.test.ts`

**Interfaces:**
- Produces: `AppliedLayer` type, `applyProduct(layers, product)`, `removeLayer(layers, category)`,
  `setOpacity(layers, category, opacity)`, `toggleVisible(layers, category)`,
  `moveLayer(layers, fromCategory, toCategory)`, `clearLook()`. Task 3's context and Task 6's
  `RenderCanvas` consume `AppliedLayer` exactly as defined here.

- [ ] **Step 1: Write the failing test — `src/lib/tryon/session.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  applyProduct,
  removeLayer,
  setOpacity,
  toggleVisible,
  moveLayer,
  clearLook,
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/tryon/session.test.ts
```

Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Write `src/lib/tryon/session.ts`**

```ts
import type { CatalogProduct } from "@/lib/catalog/types";

export type AppliedLayer = {
  category: CatalogProduct["category"];
  product: CatalogProduct;
  opacity: number;
  visible: boolean;
};

const DEFAULT_Z_ORDER: CatalogProduct["category"][] = [
  "FOUNDATION",
  "SETTING_POWDER",
  "BRONZER",
  "BLUSH",
  "HIGHLIGHTER",
  "EYESHADOW",
  "LIPSTICK",
];

export function applyProduct(layers: AppliedLayer[], product: CatalogProduct): AppliedLayer[] {
  const existingIndex = layers.findIndex((l) => l.category === product.category);
  if (existingIndex !== -1) {
    const next = [...layers];
    next[existingIndex] = { ...next[existingIndex], product };
    return next;
  }
  const rank = DEFAULT_Z_ORDER.indexOf(product.category);
  const insertAt = layers.findIndex((l) => DEFAULT_Z_ORDER.indexOf(l.category) > rank);
  const newLayer: AppliedLayer = { category: product.category, product, opacity: 1, visible: true };
  if (insertAt === -1) return [...layers, newLayer];
  return [...layers.slice(0, insertAt), newLayer, ...layers.slice(insertAt)];
}

export function removeLayer(
  layers: AppliedLayer[],
  category: CatalogProduct["category"]
): AppliedLayer[] {
  return layers.filter((l) => l.category !== category);
}

export function setOpacity(
  layers: AppliedLayer[],
  category: CatalogProduct["category"],
  opacity: number
): AppliedLayer[] {
  const clamped = Math.min(1, Math.max(0, opacity));
  return layers.map((l) => (l.category === category ? { ...l, opacity: clamped } : l));
}

export function toggleVisible(
  layers: AppliedLayer[],
  category: CatalogProduct["category"]
): AppliedLayer[] {
  return layers.map((l) => (l.category === category ? { ...l, visible: !l.visible } : l));
}

export function moveLayer(
  layers: AppliedLayer[],
  fromCategory: CatalogProduct["category"],
  toCategory: CatalogProduct["category"]
): AppliedLayer[] {
  const fromIndex = layers.findIndex((l) => l.category === fromCategory);
  const toIndex = layers.findIndex((l) => l.category === toCategory);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return layers;
  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function clearLook(): AppliedLayer[] {
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/tryon/session.test.ts
```

Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tryon/session.ts src/lib/tryon/session.test.ts
git commit -m "feat: add try-on session pure state functions"
```

---

### Task 2: Category render config

**Files:**
- Create: `src/lib/webgl/categoryZones.ts`
- Test: `src/lib/webgl/categoryZones.test.ts`

**Interfaces:**
- Consumes: `ZoneName` from `@/lib/facemesh/zones` (Phase 4), `BlendMode` from
  `./compositor` (Phase 4), `CatalogProduct`/`CATEGORIES` from `@/lib/catalog/types`.
- Produces: `CategoryZoneEntry`, `CategoryRenderConfig`,
  `CATEGORY_RENDER: Record<CatalogProduct["category"], CategoryRenderConfig>`. Task 6's
  `RenderCanvas` consumes this exactly.

- [ ] **Step 1: Write the failing test — `src/lib/webgl/categoryZones.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CATEGORY_RENDER } from "./categoryZones";
import { CATEGORIES } from "@/lib/catalog/types";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";

describe("CATEGORY_RENDER", () => {
  it("has an entry for every catalog category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_RENDER[category]).toBeDefined();
    }
  });

  it("only references zones that exist in ZONE_LANDMARKS", () => {
    for (const category of CATEGORIES) {
      for (const entry of CATEGORY_RENDER[category].entries) {
        expect(ZONE_LANDMARKS[entry.zone]).toBeDefined();
      }
    }
  });

  it("matches the CLAUDE.md Rendering Fidelity Targets baseline values", () => {
    expect(CATEGORY_RENDER.FOUNDATION).toEqual({
      entries: [{ zone: "faceOval", featherPx: 8 }],
      blendMode: "multiply",
      baseOpacity: 0.18,
    });
    expect(CATEGORY_RENDER.SETTING_POWDER).toEqual({
      entries: [{ zone: "faceOval", featherPx: 8 }],
      blendMode: "multiply",
      baseOpacity: 0.06,
    });
    expect(CATEGORY_RENDER.BRONZER).toEqual({
      entries: [
        { zone: "forehead", featherPx: 14 },
        { zone: "jawline", featherPx: 14 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.18,
    });
    expect(CATEGORY_RENDER.BLUSH).toEqual({
      entries: [
        { zone: "leftCheek", featherPx: 12 },
        { zone: "rightCheek", featherPx: 12 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.32,
    });
    expect(CATEGORY_RENDER.HIGHLIGHTER).toEqual({
      entries: [
        { zone: "leftCheek", featherPx: 10 },
        { zone: "rightCheek", featherPx: 10 },
      ],
      blendMode: "screen",
      baseOpacity: 0.25,
    });
    expect(CATEGORY_RENDER.EYESHADOW).toEqual({
      entries: [
        { zone: "leftEye", featherPx: 3 },
        { zone: "rightEye", featherPx: 3 },
      ],
      blendMode: "multiply",
      baseOpacity: 0.32,
    });
    expect(CATEGORY_RENDER.LIPSTICK).toEqual({
      entries: [{ zone: "lips", featherPx: 2 }],
      blendMode: "multiply",
      baseOpacity: 0.55,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/webgl/categoryZones.test.ts
```

Expected: FAIL — `Cannot find module './categoryZones'`.

- [ ] **Step 3: Write `src/lib/webgl/categoryZones.ts`**

```ts
import type { CatalogProduct } from "@/lib/catalog/types";
import type { ZoneName } from "@/lib/facemesh/zones";
import type { BlendMode } from "./compositor";

export type CategoryZoneEntry = { zone: ZoneName; featherPx: number };

export type CategoryRenderConfig = {
  entries: CategoryZoneEntry[];
  blendMode: BlendMode;
  baseOpacity: number;
};

export const CATEGORY_RENDER: Record<CatalogProduct["category"], CategoryRenderConfig> = {
  FOUNDATION: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.18,
  },
  SETTING_POWDER: {
    entries: [{ zone: "faceOval", featherPx: 8 }],
    blendMode: "multiply",
    baseOpacity: 0.06,
  },
  BRONZER: {
    entries: [
      { zone: "forehead", featherPx: 14 },
      { zone: "jawline", featherPx: 14 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.18,
  },
  BLUSH: {
    entries: [
      { zone: "leftCheek", featherPx: 12 },
      { zone: "rightCheek", featherPx: 12 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
  },
  HIGHLIGHTER: {
    entries: [
      { zone: "leftCheek", featherPx: 10 },
      { zone: "rightCheek", featherPx: 10 },
    ],
    blendMode: "screen",
    baseOpacity: 0.25,
  },
  EYESHADOW: {
    entries: [
      { zone: "leftEye", featherPx: 3 },
      { zone: "rightEye", featherPx: 3 },
    ],
    blendMode: "multiply",
    baseOpacity: 0.32,
  },
  LIPSTICK: {
    entries: [{ zone: "lips", featherPx: 2 }],
    blendMode: "multiply",
    baseOpacity: 0.55,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/webgl/categoryZones.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/webgl/categoryZones.ts src/lib/webgl/categoryZones.test.ts
git commit -m "feat: add category-to-zone render config"
```

---

### Task 3: `TryOnSessionProvider` + layout wiring

**Files:**
- Create: `src/lib/tryon/TryOnSessionContext.tsx`
- Modify: `src/app/(tabs)/layout.tsx`

**Interfaces:**
- Consumes: `AppliedLayer`, `applyProduct`, `removeLayer`, `setOpacity`, `toggleVisible`,
  `moveLayer`, `clearLook` (Task 1).
- Produces: `TryOnSessionProvider({ children })`, `useTryOnSession(): { layers: AppliedLayer[];
  addProduct(product); removeLayer(category); setOpacity(category, opacity);
  toggleVisible(category); moveLayer(from, to); clearLook() }`. Tasks 4, 5, and 6 all consume
  `useTryOnSession` exactly as defined here.

No Vitest here — this is a React Context with `localStorage`/DOM dependencies, consistent
with Phase 4's pattern of verifying interactive/DOM-dependent code via Playwright rather
than Vitest (the project's `vitest.config.ts` only includes `src/**/*.test.ts`, not `.tsx`).
Its behavior (persistence, `addProduct` wiring) is verified end-to-end in Task 6's Playwright
pass, once there's a page that actually uses it.

- [ ] **Step 1: Write `src/lib/tryon/TryOnSessionContext.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import {
  applyProduct,
  removeLayer as removeLayerFn,
  setOpacity as setOpacityFn,
  toggleVisible as toggleVisibleFn,
  moveLayer as moveLayerFn,
  clearLook as clearLookFn,
  type AppliedLayer,
} from "./session";

const STORAGE_KEY = "shadestack.tryon.session.v1";

type TryOnSessionValue = {
  layers: AppliedLayer[];
  addProduct: (product: CatalogProduct) => void;
  removeLayer: (category: CatalogProduct["category"]) => void;
  setOpacity: (category: CatalogProduct["category"], opacity: number) => void;
  toggleVisible: (category: CatalogProduct["category"]) => void;
  moveLayer: (from: CatalogProduct["category"], to: CatalogProduct["category"]) => void;
  clearLook: () => void;
};

const TryOnSessionContext = createContext<TryOnSessionValue | null>(null);

export function TryOnSessionProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<AppliedLayer[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLayers(JSON.parse(raw) as AppliedLayer[]);
    } catch {
      setLayers([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
    } catch {
      // localStorage unavailable (private browsing quota, etc.) — session
      // still works in-memory for the current page load.
    }
  }, [layers]);

  const value: TryOnSessionValue = {
    layers,
    addProduct: (product) => setLayers((prev) => applyProduct(prev, product)),
    removeLayer: (category) => setLayers((prev) => removeLayerFn(prev, category)),
    setOpacity: (category, opacity) => setLayers((prev) => setOpacityFn(prev, category, opacity)),
    toggleVisible: (category) => setLayers((prev) => toggleVisibleFn(prev, category)),
    moveLayer: (from, to) => setLayers((prev) => moveLayerFn(prev, from, to)),
    clearLook: () => setLayers(clearLookFn()),
  };

  return <TryOnSessionContext.Provider value={value}>{children}</TryOnSessionContext.Provider>;
}

export function useTryOnSession(): TryOnSessionValue {
  const ctx = useContext(TryOnSessionContext);
  if (!ctx) throw new Error("useTryOnSession must be used within a TryOnSessionProvider");
  return ctx;
}
```

- [ ] **Step 2: Modify `src/app/(tabs)/layout.tsx`**

```tsx
import { BottomNav } from "@/components/nav/BottomNav";
import { TryOnSessionProvider } from "@/lib/tryon/TryOnSessionContext";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TryOnSessionProvider>
      <div className="min-h-screen pb-20">
        {children}
        <BottomNav />
      </div>
    </TryOnSessionProvider>
  );
}
```

- [ ] **Step 3: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tryon/TryOnSessionContext.tsx src/app/\(tabs\)/layout.tsx
git commit -m "feat: add try-on session context with localStorage persistence"
```

---

### Task 4: `LayerPanel` + `LayerRow` (drag-to-reorder)

**Files:**
- Create: `src/components/layers/LayerRow.tsx`
- Create: `src/components/layers/LayerPanel.tsx`

**Interfaces:**
- Consumes: `useTryOnSession` (Task 3), `AppliedLayer` (Task 1).
- Produces: `LayerRow({ layer: AppliedLayer })`, `LayerPanel()` — no props, reads the session
  itself. Task 6's `TryOnView` renders `<LayerPanel />` directly.

- [ ] **Step 1: Install dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write `src/components/layers/LayerRow.tsx`**

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AppliedLayer } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";

type Props = {
  layer: AppliedLayer;
};

export function LayerRow({ layer }: Props) {
  const { setOpacity, toggleVisible, removeLayer } = useTryOnSession();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: layer.category,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`layer-row-${layer.category}`}
      className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
    >
      <button
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${layer.category}`}
        aria-label={`Reorder ${layer.product.name}`}
        className="shrink-0 cursor-grab touch-none px-1 text-textFaint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ⠿
      </button>
      <div
        className="h-10 w-10 shrink-0 rounded-card"
        style={{
          background: `linear-gradient(145deg, ${layer.product.colorHex}cc, ${layer.product.colorHex})`,
          boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.35)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{layer.product.name}</p>
        <p className="truncate text-xs text-textMuted">{layer.category}</p>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(layer.opacity * 100)}
          onChange={(e) => setOpacity(layer.category, Number(e.target.value) / 100)}
          aria-label={`${layer.product.name} opacity`}
          data-testid={`opacity-${layer.category}`}
          className="mt-1 w-full accent-accent"
        />
      </div>
      <button
        onClick={() => toggleVisible(layer.category)}
        aria-label={layer.visible ? "Hide layer" : "Show layer"}
        aria-pressed={layer.visible}
        data-testid={`toggle-visible-${layer.category}`}
        className="shrink-0 rounded-full p-2 text-ink transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {layer.visible ? "👁" : "🚫"}
      </button>
      <button
        onClick={() => removeLayer(layer.category)}
        aria-label={`Remove ${layer.product.name}`}
        data-testid={`remove-${layer.category}`}
        className="shrink-0 rounded-full p-2 text-textSecondary transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/layers/LayerPanel.tsx`**

```tsx
"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { LayerRow } from "./LayerRow";

export function LayerPanel() {
  const { layers, moveLayer, clearLook } = useTryOnSession();
  const topFirst = [...layers].reverse();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveLayer(
      active.id as CatalogProduct["category"],
      over.id as CatalogProduct["category"]
    );
  }

  return (
    <section className="px-5 py-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
        Active Layers
      </h2>
      {layers.length === 0 ? (
        <p data-testid="active-layers-empty" className="mt-3 text-sm text-textMuted">
          No products applied yet — add one below to start your look.
        </p>
      ) : (
        <>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={topFirst.map((l) => l.category)}
              strategy={verticalListSortingStrategy}
            >
              <div className="mt-2 rounded-card border border-border">
                {topFirst.map((layer) => (
                  <LayerRow key={layer.category} layer={layer} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={clearLook}
            data-testid="clear-look-button"
            className="mt-3 rounded-pill border border-border px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Clear Look
          </button>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors. (`LayerPanel`/`LayerRow` aren't imported by any
page yet, so nothing renders them until Task 6 — this step just confirms they compile.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/layers/LayerRow.tsx src/components/layers/LayerPanel.tsx
git commit -m "feat: add LayerPanel and LayerRow with drag-to-reorder"
```

---

### Task 5: In-tab Add Products section + "Try On" button wiring

**Files:**
- Create: `src/components/catalog/SearchIconButton.tsx`
- Modify: `src/components/catalog/DiscoverView.tsx`
- Create: `src/components/tryon/AddProductsSection.tsx`
- Modify: `src/components/catalog/ProductCard.tsx`
- Modify: `src/components/detail/ProductDetailSheet.tsx`

**Interfaces:**
- Consumes: `useTryOnSession` (Task 3); `CategoryChips`, `ProductList`, `SearchOverlay`,
  `filterByCategory` (Phase 2, unchanged); `ProductDetailSheet` (Phase 2, modified below).
- Produces: `SearchIconButton({ onClick })`, `AddProductsSection({ products: CatalogProduct[] })`.
  Task 6's `TryOnView` renders `<AddProductsSection products={products} />`.

- [ ] **Step 1: Extract `src/components/catalog/SearchIconButton.tsx`**

`DiscoverView` and the new `AddProductsSection` both need the same search-icon button;
extracting it avoids duplicating the inline SVG.

```tsx
"use client";

type Props = {
  onClick: () => void;
};

export function SearchIconButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Search"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Modify `src/components/catalog/DiscoverView.tsx`**

Replace the inline search button with `SearchIconButton`. Add the import:

```tsx
import { SearchIconButton } from "./SearchIconButton";
```

Replace this block:

```tsx
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
```

with:

```tsx
        <SearchIconButton onClick={() => setSearchOpen(true)} />
```

- [ ] **Step 3: Write `src/components/tryon/AddProductsSection.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "@/components/catalog/CategoryChips";
import { ProductList } from "@/components/catalog/ProductList";
import { SearchOverlay } from "@/components/catalog/SearchOverlay";
import { SearchIconButton } from "@/components/catalog/SearchIconButton";
import { filterByCategory } from "@/components/catalog/filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function AddProductsSection({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const visibleProducts = filterByCategory(products, activeCategory);

  return (
    <section className="pb-4">
      <div className="flex items-center justify-between px-5 pt-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
          Add Products
        </h2>
        <SearchIconButton onClick={() => setSearchOpen(true)} />
      </div>
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      <ProductList products={visibleProducts} onSelect={setSelectedProduct} />
      {searchOpen && (
        <SearchOverlay
          products={products}
          onClose={() => setSearchOpen(false)}
          onSelect={(product) => {
            setSearchOpen(false);
            setSelectedProduct(product);
          }}
        />
      )}
      {selectedProduct && (
        <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Modify `src/components/catalog/ProductCard.tsx`**

Add the import and wire the existing "Try On" link's `onClick`. Add:

```tsx
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
```

Inside the component, before the `return`:

```tsx
  const { addProduct } = useTryOnSession();
```

Change the "Try On" `<Link>` from:

```tsx
      <Link
        href="/try-on"
        className="shrink-0 rounded-pill bg-chip px-3 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Try On
      </Link>
```

to:

```tsx
      <Link
        href="/try-on"
        onClick={() => addProduct(product)}
        data-testid={`try-on-${product.id}`}
        className="shrink-0 rounded-pill bg-chip px-3 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Try On
      </Link>
```

- [ ] **Step 5: Modify `src/components/detail/ProductDetailSheet.tsx`**

Add the import:

```tsx
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
```

Inside the component, before the `return`:

```tsx
  const { addProduct } = useTryOnSession();
```

Change the "Try On" `<Link>` from:

```tsx
          <Link
            href="/try-on"
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Try On
          </Link>
```

to:

```tsx
          <Link
            href="/try-on"
            onClick={() => addProduct(product)}
            data-testid={`try-on-${product.id}`}
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Try On
          </Link>
```

- [ ] **Step 6: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/catalog/SearchIconButton.tsx src/components/catalog/DiscoverView.tsx \
  src/components/tryon/AddProductsSection.tsx src/components/catalog/ProductCard.tsx \
  src/components/detail/ProductDetailSheet.tsx
git commit -m "feat: add in-tab Add Products section and wire Try On buttons to session"
```

---

### Task 6: Wire the session into the render pipeline + Try On tab; full verification

**Files:**
- Modify: `src/components/tryon/RenderCanvas.tsx`
- Modify: `src/components/tryon/FaceMeshTracker.tsx`
- Create: `src/components/tryon/TryOnView.tsx`
- Modify: `src/app/(tabs)/try-on/page.tsx`

**Interfaces:**
- Consumes: `AppliedLayer` (Task 1), `CATEGORY_RENDER` (Task 2), `useTryOnSession` (Task 3),
  `LayerPanel` (Task 4), `AddProductsSection` (Task 5), `landmarksToPolygon`/`ZONE_LANDMARKS`
  /`renderComposite`/`hexToRgb01` (Phase 4, unchanged).
- Produces: `RenderCanvas`'s new prop shape (`layers` added), `FaceMeshTracker`'s new prop
  shape (`layers` added), `TryOnView({ products: CatalogProduct[] })`. Nothing downstream of
  this task — it's the final assembly.

- [ ] **Step 1: Modify `src/components/tryon/RenderCanvas.tsx`**

Replace the whole file (the hardcoded demo `layers` array is gone; layers now come from the
session via props):

```tsx
"use client";

import { useEffect, useRef } from "react";
import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { renderComposite, hexToRgb01, type Layer } from "@/lib/webgl/compositor";
import { CATEGORY_RENDER } from "@/lib/webgl/categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";

type Props = {
  image: HTMLImageElement;
  points: Point[];
  width: number;
  height: number;
  layers: AppliedLayer[];
};

export function RenderCanvas({ image, points, width, height, layers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const glLayers: Layer[] = layers
      .filter((l) => l.visible)
      .flatMap((l) => {
        const config = CATEGORY_RENDER[l.category];
        return config.entries.map(({ zone, featherPx }) => ({
          polygon: landmarksToPolygon(points, ZONE_LANDMARKS[zone], width, height),
          tintColor: hexToRgb01(l.product.colorHex),
          opacity: config.baseOpacity * l.opacity,
          blendMode: config.blendMode,
          featherPx,
        }));
      });

    renderComposite(canvas, image, glLayers);
  }, [image, points, width, height, layers]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="render-canvas"
      className="pointer-events-none absolute inset-0"
    />
  );
}
```

- [ ] **Step 2: Modify `src/components/tryon/FaceMeshTracker.tsx`**

Add a `layers` prop and pass it through to `RenderCanvas`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas } from "./RenderCanvas";
import type { AppliedLayer } from "@/lib/tryon/session";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 600;

type Props = {
  layers: AppliedLayer[];
};

export function FaceMeshTracker({ layers }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const state = useFaceLandmarks(imageRef, imageLoaded);

  // The <img src> is present in the server-rendered HTML, so the browser can
  // start (and finish) loading it before React hydrates and attaches the
  // onLoad listener below — the native "load" event fires once and is missed
  // in that race. Catch the already-complete case on mount as a fallback.
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setImageLoaded(true);
      setImageEl(imageRef.current);
    }
  }, []);

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card"
        style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src="/model-face.svg"
          alt="Illustrated model face"
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          onLoad={(e) => {
            setImageLoaded(true);
            setImageEl(e.currentTarget);
          }}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && imageEl && (
          <RenderCanvas
            image={imageEl}
            points={state.points}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            layers={layers}
          />
        )}
      </div>
      {state.status === "loading" && (
        <p className="mt-2 text-center text-xs text-textMuted">Loading face tracking…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 text-center text-xs text-textMuted">No face detected.</p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Face tracking error: {state.message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/tryon/TryOnView.tsx`**

```tsx
"use client";

import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { AddProductsSection } from "./AddProductsSection";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { layers } = useTryOnSession();

  return (
    <main className="pb-6">
      <h1 className="px-5 pt-6 font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active="model" />
      </div>
      <div className="mt-4 px-5">
        <FaceMeshTracker layers={layers} />
      </div>
      <LayerPanel />
      <AddProductsSection products={products} />
    </main>
  );
}
```

- [ ] **Step 4: Modify `src/app/(tabs)/try-on/page.tsx`**

Becomes an async server component, mirroring `discover/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { TryOnView } from "@/components/tryon/TryOnView";

export default async function TryOnPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return <TryOnView products={catalogProducts} />;
}
```

- [ ] **Step 5: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 6: Verify with Playwright against the live dev server**

```bash
cd "C:/Users/sprin/shadestack"
npm run dev > /tmp/webgl-dev.log 2>&1 &
echo $! > /tmp/webgl-dev.pid
timeout 30 bash -c 'until curl -sf http://localhost:3000/try-on >/dev/null; do sleep 1; done'
```

Reuse the Playwright installation from Phases 3–4 (`/tmp/pw-verify`), reinstalling only if
missing:
`mkdir -p /tmp/pw-verify && cd /tmp/pw-verify && npm init -y >/dev/null 2>&1 && npm install playwright >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1`

```bash
cat > /tmp/pw-verify/verify-phase5.mjs <<'EOF'
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

async function averageColor() {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="render-canvas"]');
    const gl = canvas.getContext("webgl");
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++;
    }
    return [r / n, g / n, b / n];
  });
}

function setRangeValue(locator, val) {
  return locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, val);
}

// 1. Empty state on first load (fresh browser context => empty localStorage)
await page.goto("http://localhost:3000/try-on", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="render-canvas"]', { timeout: 20000 });
await page.waitForTimeout(500);
const emptyStateVisible = await page.isVisible('[data-testid="active-layers-empty"]');
const baseColor = await averageColor();
console.log("EMPTY_STATE_VISIBLE:", emptyStateVisible, "BASE_AVG_COLOR:", baseColor);

// 2. Add a BLUSH product from the in-tab Add Products section
await page.click('button[aria-pressed="false"]:has-text("Blush")');
await page.waitForTimeout(200);
await page.locator('[data-testid^="try-on-"]').first().click();
await page.waitForSelector('[data-testid="layer-row-BLUSH"]', { timeout: 5000 });
const colorAfterAdd = await averageColor();
console.log("AVG_COLOR_AFTER_ADD:", colorAfterAdd);

// 3. Toggle visibility off, confirm the average render color reverts toward
// the base (untinted) color, then toggle back on and confirm it matches the
// tinted color again.
await page.click('[data-testid="toggle-visible-BLUSH"]');
await page.waitForTimeout(200);
const colorAfterHide = await averageColor();
await page.click('[data-testid="toggle-visible-BLUSH"]');
await page.waitForTimeout(200);
const colorAfterShow = await averageColor();
console.log("AVG_COLOR_AFTER_HIDE:", colorAfterHide, "AVG_COLOR_AFTER_SHOW:", colorAfterShow);

// 4. Lower the opacity slider and confirm the average color shifts again
await setRangeValue(page.locator('[data-testid="opacity-BLUSH"]'), "20");
await page.waitForTimeout(200);
const colorAfterOpacityDown = await averageColor();
console.log("AVG_COLOR_AFTER_OPACITY_DOWN:", colorAfterOpacityDown);

// 5. Add a LIPSTICK product, then drag-reorder it above BLUSH
await page.click('button[aria-pressed="false"]:has-text("Lipstick")');
await page.waitForTimeout(200);
await page.locator('[data-testid^="try-on-"]').first().click();
await page.waitForSelector('[data-testid="layer-row-LIPSTICK"]', { timeout: 5000 });

const orderBeforeDrag = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid^="layer-row-"]')).map((el) =>
    el.getAttribute("data-testid")
  )
);

const lipstickHandle = page.locator('[data-testid="drag-handle-LIPSTICK"]');
const blushHandle = page.locator('[data-testid="drag-handle-BLUSH"]');
const lipstickBox = await lipstickHandle.boundingBox();
const blushBox = await blushHandle.boundingBox();
await page.mouse.move(lipstickBox.x + lipstickBox.width / 2, lipstickBox.y + lipstickBox.height / 2);
await page.mouse.down();
await page.mouse.move(blushBox.x + blushBox.width / 2, blushBox.y + blushBox.height / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);

const orderAfterDrag = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid^="layer-row-"]')).map((el) =>
    el.getAttribute("data-testid")
  )
);
console.log("ROW_ORDER_BEFORE_DRAG:", JSON.stringify(orderBeforeDrag));
console.log("ROW_ORDER_AFTER_DRAG:", JSON.stringify(orderAfterDrag));

// 6. Remove the BLUSH layer
await page.click('[data-testid="remove-BLUSH"]');
await page.waitForTimeout(200);
const blushRowGone = (await page.locator('[data-testid="layer-row-BLUSH"]').count()) === 0;
console.log("BLUSH_ROW_GONE:", blushRowGone);

// 7. Reload and confirm the LIPSTICK layer persisted via localStorage
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="render-canvas"]', { timeout: 20000 });
await page.waitForTimeout(500);
const lipstickPersisted = (await page.locator('[data-testid="layer-row-LIPSTICK"]').count()) === 1;
console.log("LIPSTICK_PERSISTED_AFTER_RELOAD:", lipstickPersisted);

// 8. Add a product from Discover and confirm it lands in the Try On tab's session
await page.goto("http://localhost:3000/discover", { waitUntil: "networkidle" });
await page.click('button[aria-pressed="false"]:has-text("Foundation")');
await page.waitForTimeout(200);
await page.locator('[data-testid^="try-on-"]').first().click();
await page.waitForURL("**/try-on");
await page.waitForSelector('[data-testid="layer-row-FOUNDATION"]', { timeout: 5000 });
console.log("FOUNDATION_ADDED_FROM_DISCOVER: true");

// 9. Clear Look
await page.click('[data-testid="clear-look-button"]');
await page.waitForTimeout(200);
const emptyAfterClear = await page.isVisible('[data-testid="active-layers-empty"]');
const colorAfterClear = await averageColor();
console.log("EMPTY_AFTER_CLEAR:", emptyAfterClear, "AVG_COLOR_AFTER_CLEAR:", colorAfterClear);

await page.screenshot({ path: "/tmp/pw-verify/phase5-screenshot.png" });
console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors));

await browser.close();
EOF
cd /tmp/pw-verify && node verify-phase5.mjs
```

Expected, and what to do if it doesn't hold:

- `EMPTY_STATE_VISIBLE: true` on first load.
- `AVG_COLOR_AFTER_ADD` differs measurably from `BASE_AVG_COLOR` (blush tint applied).
- `AVG_COLOR_AFTER_HIDE` is close to `BASE_AVG_COLOR` (further from `AVG_COLOR_AFTER_ADD`
  than `AVG_COLOR_AFTER_SHOW` is), and `AVG_COLOR_AFTER_SHOW` equals `AVG_COLOR_AFTER_ADD`
  (toggling back on is deterministic re-render). If hide/show don't change the color at all,
  the `visible` filter in `RenderCanvas` (Step 1) isn't wired correctly — check the
  `.filter((l) => l.visible)` call.
- `AVG_COLOR_AFTER_OPACITY_DOWN` differs from `AVG_COLOR_AFTER_SHOW` (lower opacity = tint
  color closer to `BASE_AVG_COLOR`). If not, check that the opacity slider's `input` event is
  actually reaching `setOpacity` — range inputs need the native-setter dispatch trick used in
  `setRangeValue`, plain `.fill()` does not reliably work on `type="range"`.
- `ROW_ORDER_AFTER_DRAG` differs from `ROW_ORDER_BEFORE_DRAG` (specifically,
  `layer-row-LIPSTICK` should now appear before `layer-row-BLUSH`, since dragging the
  Lipstick handle onto the Blush row's position should move it there). If the order is
  unchanged, the drag simulation likely needs more intermediate `page.mouse.move` steps or a
  short `waitForTimeout` between `down` and the first `move` for `@dnd-kit`'s `PointerSensor`
  activation constraint to register — adjust and retry before concluding it's a real bug.
- `BLUSH_ROW_GONE: true`.
- `LIPSTICK_PERSISTED_AFTER_RELOAD: true` — if `false`, check the two `localStorage`
  `useEffect`s in `TryOnSessionContext.tsx` (read-on-mount, write-on-change).
- `FOUNDATION_ADDED_FROM_DISCOVER` log line reached (the `waitForSelector` before it would
  otherwise time out and fail the script) — confirms `ProductCard`'s Try On button (used on
  Discover) adds to the same session `TryOnSessionProvider` shares across tabs.
- `EMPTY_AFTER_CLEAR: true` and `AVG_COLOR_AFTER_CLEAR` ≈ `BASE_AVG_COLOR`.
- `CONSOLE_ERRORS` contains only the known benign MediaPipe XNNPACK line, nothing else.

Open `/tmp/pw-verify/phase5-screenshot.png` (taken right after Clear Look, so it should show
the plain untinted Model face and an empty Active Layers section) and visually sanity-check
it matches that expectation.

Stop the dev server:

```bash
kill $(cat /tmp/webgl-dev.pid) 2>/dev/null
```

- [ ] **Step 7: Commit**

```bash
git add src/components/tryon/RenderCanvas.tsx src/components/tryon/FaceMeshTracker.tsx \
  src/components/tryon/TryOnView.tsx src/app/\(tabs\)/try-on/page.tsx
git commit -m "feat: wire try-on session into WebGL render pipeline and Try On tab"
```

---

## Self-Review

**Spec coverage:** Design doc section 1 (session state) — Task 1 (pure functions) + Task 3
(Context/persistence). Section 2 (category render config) — Task 2. Section 3 (components:
`LayerPanel`, `LayerRow`, `AddProductsSection`) — Tasks 4–5. Section 3's "Try On" button
wiring on `ProductCard`/`ProductDetailSheet` — Task 5 Steps 4–5. Section 3's `TryOnView` +
`try-on/page.tsx` — Task 6. New dependency (`@dnd-kit/*`) — Task 4 Step 1. Testing section —
Vitest in Tasks 1–2, Playwright in Task 6 covering every bullet the design doc lists (add,
toggle, opacity, drag-reorder, remove, clear, persistence, cross-tab add). Error handling
section (corrupt localStorage, zero layers) — Task 3's try/catch and Task 6's `RenderCanvas`
empty-array behavior (no special-casing needed, confirmed in Task 6 Step 6's empty/clear
checks). "Complete Your Look" is not referenced by any task — correctly excluded.

**Placeholder scan:** none — every step has complete file contents or a complete diff, exact
commands, and concrete expected output with a troubleshooting path for the two
genuinely-uncertain-until-run details (drag-simulation timing, range-input event dispatch).

**Type consistency:** `AppliedLayer` defined once in Task 1, imported (never redefined) by
Tasks 3, 4, and 6. `useTryOnSession`'s return shape defined once in Task 3 and consumed
identically in Tasks 4, 5, and 6 (`addProduct`, `removeLayer`, `setOpacity`, `toggleVisible`,
`moveLayer`, `clearLook` — no renamed variants anywhere). `CATEGORY_RENDER`'s shape (Task 2)
matches exactly how Task 6's `RenderCanvas` destructures it (`entries`, `blendMode`,
`baseOpacity`, each entry's `zone`/`featherPx`). `data-testid` values used in Task 6's
Playwright script match exactly what Tasks 4–5 render (`layer-row-<category>`,
`drag-handle-<category>`, `opacity-<category>`, `toggle-visible-<category>`,
`remove-<category>`, `active-layers-empty`, `clear-look-button`, `try-on-<product.id>`,
`render-canvas`).
