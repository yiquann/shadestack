# Phase 2: Catalog API + Discover Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the catalog API routes and the full Discover tab (category chips, hero banner, product list, search overlay, product detail sheet) per CLAUDE.md's spec and the Phase 2 design doc.

**Architecture:** A Server Component (`discover/page.tsx`) loads the full catalog once via Prisma and hands it to a client component tree that filters in-memory for chips/search. Three API routes (`/api/products`, `/api/products/[id]`, `/api/products/[id]/similar`) are built independently and consumed on-demand by the product detail sheet's similar-products carousel. All filtering/query logic lives in pure, unit-tested functions separate from the React components and route handlers that call them.

**Tech Stack:** Next.js App Router (Server + Client Components), Prisma, Tailwind v4, Vitest.

## Global Constraints

- Colors/spacing only via design tokens — never hardcode hex in components (CLAUDE.md Conventions).
- TypeScript strict mode; no `any`.
- One product per category per look, active-side-only edits in compare mode — not relevant to this phase (no try-on layers yet), noted for later phases.
- Test scope for this phase: pure logic only (vitest), no component rendering tests — UI verified via dev server (per `docs/superpowers/specs/2026-07-17-phase2-catalog-discover-design.md` decision 7).
- Category enum values: `FOUNDATION, BLUSH, BRONZER, HIGHLIGHTER, EYESHADOW, LIPSTICK, SETTING_POWDER`.
- Design tokens live in `src/lib/tokens.ts` (`DESIGN_TOKENS`) — reuse, don't redefine.
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`).

---

### Task 1: Catalog types + pure query/filter/similar logic

**Files:**
- Create: `src/lib/catalog/types.ts`
- Create: `src/lib/catalog/queryParams.ts`
- Create: `src/lib/catalog/queryParams.test.ts`
- Create: `src/lib/catalog/similar.ts`
- Create: `src/lib/catalog/similar.test.ts`
- Create: `src/components/catalog/filtering.ts`
- Create: `src/components/catalog/filtering.test.ts`

**Interfaces:**
- Produces: `CatalogProduct` type (`id, category, name, brand, shade, colorHex, price: number, coverage, finish, skinType, desc`), `CATEGORIES` const array, `toCatalogProduct(product): CatalogProduct` (converts a Prisma `Product`'s `Decimal` price to `number` — required because Next.js can't pass a `Decimal` instance from a Server Component to a Client Component, and `NextResponse.json` needs a plain number too).
- Produces: `ProductQuery` type, `parseAndValidateProductQuery(searchParams: URLSearchParams): { valid: true; query: ProductQuery } | { valid: false; errors: string[] }`, `applyProductQuery(products: CatalogProduct[], query: ProductQuery): CatalogProduct[]`.
- Produces: `selectSimilarProducts(products: CatalogProduct[], target: CatalogProduct, limit?: number): CatalogProduct[]`.
- Produces: `filterByCategory(products: CatalogProduct[], category: CatalogProduct["category"] | "ALL"): CatalogProduct[]`, `searchProducts(products: CatalogProduct[], query: string): CatalogProduct[]`.
- Later tasks (2-6) import all of the above — these are the only names to use, no renaming.

- [ ] **Step 1: Write `src/lib/catalog/types.ts`**

```ts
export const CATEGORIES = [
  "FOUNDATION",
  "BLUSH",
  "BRONZER",
  "HIGHLIGHTER",
  "EYESHADOW",
  "LIPSTICK",
  "SETTING_POWDER",
] as const;

export type CatalogProduct = {
  id: string;
  category: (typeof CATEGORIES)[number];
  name: string;
  brand: string;
  shade: string;
  colorHex: string;
  price: number;
  coverage: string;
  finish: string;
  skinType: string;
  desc: string;
};

type PrismaProductLike = {
  id: string;
  category: string;
  name: string;
  brand: string;
  shade: string;
  colorHex: string;
  price: unknown;
  coverage: string;
  finish: string;
  skinType: string;
  desc: string;
};

export function toCatalogProduct(product: PrismaProductLike): CatalogProduct {
  return {
    id: product.id,
    category: product.category as CatalogProduct["category"],
    name: product.name,
    brand: product.brand,
    shade: product.shade,
    colorHex: product.colorHex,
    price: Number(product.price),
    coverage: product.coverage,
    finish: product.finish,
    skinType: product.skinType,
    desc: product.desc,
  };
}
```

- [ ] **Step 2: Write the failing test — `src/lib/catalog/queryParams.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseAndValidateProductQuery, applyProductQuery } from "./queryParams";
import type { CatalogProduct } from "./types";

const PRODUCTS: CatalogProduct[] = [
  { id: "1", category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "a" },
  { id: "2", category: "LIPSTICK", name: "Lip Glow Balm", brand: "Dior", shade: "004 Coral", colorHex: "#E37B6D", price: 40, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "b" },
  { id: "3", category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "c" },
];

describe("parseAndValidateProductQuery", () => {
  it("accepts a valid category", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("category=LIPSTICK"));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.query.category).toBe("LIPSTICK");
  });

  it("rejects an invalid category", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("category=NOT_REAL"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("Invalid category");
  });

  it("parses minPrice and maxPrice as numbers", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("minPrice=10&maxPrice=50"));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.query.minPrice).toBe(10);
      expect(result.query.maxPrice).toBe(50);
    }
  });

  it("rejects a non-numeric minPrice", () => {
    const result = parseAndValidateProductQuery(new URLSearchParams("minPrice=abc"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("Invalid minPrice");
  });
});

describe("applyProductQuery", () => {
  it("filters by category", () => {
    const result = applyProductQuery(PRODUCTS, { category: "BLUSH" });
    expect(result.map((p) => p.id)).toEqual(["3"]);
  });

  it("filters by brand case-insensitively", () => {
    const result = applyProductQuery(PRODUCTS, { brand: "dior" });
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("filters by price range", () => {
    const result = applyProductQuery(PRODUCTS, { minPrice: 35, maxPrice: 40 });
    expect(result.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("filters by q across name, brand, and shade", () => {
    expect(applyProductQuery(PRODUCTS, { q: "coral" }).map((p) => p.id)).toEqual(["2"]);
    expect(applyProductQuery(PRODUCTS, { q: "yves" }).map((p) => p.id)).toEqual(["1"]);
  });

  it("returns all products when the query is empty", () => {
    expect(applyProductQuery(PRODUCTS, {})).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/catalog/queryParams.test.ts
```

Expected: FAIL — `Cannot find module './queryParams'`.

- [ ] **Step 4: Write `src/lib/catalog/queryParams.ts`**

```ts
import { CATEGORIES, type CatalogProduct } from "./types";

export type ProductQuery = {
  category?: CatalogProduct["category"];
  brand?: string;
  q?: string;
  finish?: string;
  coverage?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type QueryValidationResult =
  | { valid: true; query: ProductQuery }
  | { valid: false; errors: string[] };

export function parseAndValidateProductQuery(
  searchParams: URLSearchParams
): QueryValidationResult {
  const errors: string[] = [];
  const query: ProductQuery = {};

  const category = searchParams.get("category");
  if (category !== null) {
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`Invalid category: ${category}`);
    } else {
      query.category = category as CatalogProduct["category"];
    }
  }

  const brand = searchParams.get("brand");
  if (brand !== null) query.brand = brand;

  const q = searchParams.get("q");
  if (q !== null) query.q = q;

  const finish = searchParams.get("finish");
  if (finish !== null) query.finish = finish;

  const coverage = searchParams.get("coverage");
  if (coverage !== null) query.coverage = coverage;

  const minPriceRaw = searchParams.get("minPrice");
  if (minPriceRaw !== null) {
    const minPrice = Number(minPriceRaw);
    if (Number.isNaN(minPrice)) {
      errors.push(`Invalid minPrice: ${minPriceRaw}`);
    } else {
      query.minPrice = minPrice;
    }
  }

  const maxPriceRaw = searchParams.get("maxPrice");
  if (maxPriceRaw !== null) {
    const maxPrice = Number(maxPriceRaw);
    if (Number.isNaN(maxPrice)) {
      errors.push(`Invalid maxPrice: ${maxPriceRaw}`);
    } else {
      query.maxPrice = maxPrice;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, query };
}

export function applyProductQuery(
  products: CatalogProduct[],
  query: ProductQuery
): CatalogProduct[] {
  return products.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.brand && p.brand.toLowerCase() !== query.brand.toLowerCase()) return false;
    if (query.finish && p.finish.toLowerCase() !== query.finish.toLowerCase()) return false;
    if (query.coverage && p.coverage.toLowerCase() !== query.coverage.toLowerCase()) return false;
    if (query.minPrice !== undefined && p.price < query.minPrice) return false;
    if (query.maxPrice !== undefined && p.price > query.maxPrice) return false;
    if (query.q) {
      const needle = query.q.toLowerCase();
      const haystack = `${p.name} ${p.brand} ${p.shade}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/catalog/queryParams.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 6: Write the failing test — `src/lib/catalog/similar.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { selectSimilarProducts } from "./similar";
import type { CatalogProduct } from "./types";

const make = (overrides: Partial<CatalogProduct>): CatalogProduct => ({
  id: "id",
  category: "LIPSTICK",
  name: "name",
  brand: "brand",
  shade: "shade",
  colorHex: "#000000",
  price: 10,
  coverage: "Full",
  finish: "Matte",
  skinType: "All skin types",
  desc: "d",
  ...overrides,
});

describe("selectSimilarProducts", () => {
  it("excludes the target product itself", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [target, make({ id: "2", brand: "B" })];
    const result = selectSimilarProducts(products, target);
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  it("excludes products from the same brand as the target", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [target, make({ id: "2", brand: "A" }), make({ id: "3", brand: "B" })];
    const result = selectSimilarProducts(products, target);
    expect(result.map((p) => p.id)).toEqual(["3"]);
  });

  it("excludes products from a different category", () => {
    const target = make({ id: "1", brand: "A", category: "LIPSTICK" });
    const products = [target, make({ id: "2", brand: "B", category: "BLUSH" })];
    const result = selectSimilarProducts(products, target);
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const target = make({ id: "1", brand: "A" });
    const products = [
      target,
      make({ id: "2", brand: "B" }),
      make({ id: "3", brand: "C" }),
      make({ id: "4", brand: "D" }),
    ];
    const result = selectSimilarProducts(products, target, 2);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npx vitest run src/lib/catalog/similar.test.ts
```

Expected: FAIL — `Cannot find module './similar'`.

- [ ] **Step 8: Write `src/lib/catalog/similar.ts`**

```ts
import type { CatalogProduct } from "./types";

export function selectSimilarProducts(
  products: CatalogProduct[],
  target: CatalogProduct,
  limit = 6
): CatalogProduct[] {
  return products
    .filter(
      (p) => p.id !== target.id && p.category === target.category && p.brand !== target.brand
    )
    .slice(0, limit);
}
```

- [ ] **Step 9: Run test to verify it passes**

```bash
npx vitest run src/lib/catalog/similar.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 10: Write the failing test — `src/components/catalog/filtering.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { filterByCategory, searchProducts } from "./filtering";
import type { CatalogProduct } from "@/lib/catalog/types";

const PRODUCTS: CatalogProduct[] = [
  { id: "1", category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "a" },
  { id: "2", category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "b" },
];

describe("filterByCategory", () => {
  it("returns all products for ALL", () => {
    expect(filterByCategory(PRODUCTS, "ALL")).toHaveLength(2);
  });

  it("filters to a single category", () => {
    expect(filterByCategory(PRODUCTS, "BLUSH").map((p) => p.id)).toEqual(["2"]);
  });
});

describe("searchProducts", () => {
  it("returns all products for an empty query", () => {
    expect(searchProducts(PRODUCTS, "")).toHaveLength(2);
    expect(searchProducts(PRODUCTS, "   ")).toHaveLength(2);
  });

  it("matches case-insensitively across name, brand, and shade", () => {
    expect(searchProducts(PRODUCTS, "orgasm").map((p) => p.id)).toEqual(["2"]);
    expect(searchProducts(PRODUCTS, "NARS").map((p) => p.id)).toEqual(["2"]);
    expect(searchProducts(PRODUCTS, "le rouge").map((p) => p.id)).toEqual(["1"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchProducts(PRODUCTS, "nonexistent")).toEqual([]);
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

```bash
npx vitest run src/components/catalog/filtering.test.ts
```

Expected: FAIL — `Cannot find module './filtering'`.

- [ ] **Step 12: Write `src/components/catalog/filtering.ts`**

```ts
import type { CatalogProduct } from "@/lib/catalog/types";

export function filterByCategory(
  products: CatalogProduct[],
  category: CatalogProduct["category"] | "ALL"
): CatalogProduct[] {
  if (category === "ALL") return products;
  return products.filter((p) => p.category === category);
}

export function searchProducts(products: CatalogProduct[], query: string): CatalogProduct[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return products;
  return products.filter((p) =>
    `${p.name} ${p.brand} ${p.shade}`.toLowerCase().includes(trimmed)
  );
}
```

- [ ] **Step 13: Run all three test files to verify they pass**

```bash
npx vitest run src/lib/catalog/queryParams.test.ts src/lib/catalog/similar.test.ts src/components/catalog/filtering.test.ts
```

Expected: PASS (17 tests total).

- [ ] **Step 14: Commit**

```bash
git add src/lib/catalog/types.ts src/lib/catalog/queryParams.ts src/lib/catalog/queryParams.test.ts src/lib/catalog/similar.ts src/lib/catalog/similar.test.ts src/components/catalog/filtering.ts src/components/catalog/filtering.test.ts
git commit -m "feat: add catalog query/filter/similar-product pure logic"
git push
```

---

### Task 2: Catalog API routes

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/products/[id]/route.ts`
- Create: `src/app/api/products/[id]/similar/route.ts`

**Interfaces:**
- Consumes: `toCatalogProduct`, `CatalogProduct` from `@/lib/catalog/types` (Task 1); `parseAndValidateProductQuery`, `applyProductQuery` from `@/lib/catalog/queryParams` (Task 1); `selectSimilarProducts` from `@/lib/catalog/similar` (Task 1); `prisma` from `@/lib/prisma` (Phase 1).
- Produces: three HTTP GET endpoints later consumed by `SimilarCarousel` (Task 6).

- [ ] **Step 1: Write `src/app/api/products/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { parseAndValidateProductQuery, applyProductQuery } from "@/lib/catalog/queryParams";

export async function GET(request: NextRequest) {
  const result = parseAndValidateProductQuery(request.nextUrl.searchParams);
  if (!result.valid) {
    return NextResponse.json({ error: result.errors.join(", ") }, { status: 400 });
  }

  try {
    const products = await prisma.product.findMany();
    const catalogProducts = products.map(toCatalogProduct);
    const filtered = applyProductQuery(catalogProducts, result.query);
    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/products/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(toCatalogProduct(product));
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `src/app/api/products/[id]/similar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { selectSimilarProducts } from "@/lib/catalog/similar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const target = await prisma.product.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const sameCategory = await prisma.product.findMany({
      where: { category: target.category },
    });
    const catalogProducts = sameCategory.map(toCatalogProduct);
    const targetCatalog = toCatalogProduct(target);
    const similar = selectSimilarProducts(catalogProducts, targetCatalog);
    return NextResponse.json(similar);
  } catch {
    return NextResponse.json({ error: "Failed to fetch similar products" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds, route list includes `/api/products`, `/api/products/[id]`, `/api/products/[id]/similar`.

- [ ] **Step 5: Verify against the live dev server**

```bash
npm run dev &
```

Wait for "Ready", then:

```bash
curl -s http://localhost:3000/api/products | head -c 200
curl -s "http://localhost:3000/api/products?category=LIPSTICK" | grep -o "LIPSTICK" | wc -l
curl -s "http://localhost:3000/api/products?category=NOT_REAL" -o /dev/null -w "%{http_code}\n"
curl -s http://localhost:3000/api/products/nonexistent-id -o /dev/null -w "%{http_code}\n"
```

Expected: first call returns a JSON array; second call's count matches the LIPSTICK product count (4); third call returns `400`; fourth returns `404`. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products
git commit -m "feat: add catalog API routes (list, single, similar)"
git push
```

---

### Task 3: Global CSS additions + CategoryChips + HeroBanner

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/catalog/CategoryChips.tsx`
- Create: `src/components/catalog/HeroBanner.tsx`

**Interfaces:**
- Produces: Tailwind utilities `rounded-card` (16px), `rounded-pill` (20px); CSS `@keyframes fadeIn`, `@keyframes slideUp` for later tasks (SearchOverlay, ProductDetailSheet).
- Produces: `CategoryChips` component (`active`, `onChange` props), `HeroBanner` component (no props).
- Consumes: `CATEGORIES`, `CatalogProduct` from `@/lib/catalog/types` (Task 1); `DESIGN_TOKENS` from `@/lib/tokens` (Phase 1).

- [ ] **Step 1: Add radius tokens and keyframes to `src/app/globals.css`**

Add inside the existing `@theme inline { ... }` block (after `--font-body: var(--font-body);`):

```css
  --radius-card: 16px;
  --radius-pill: 20px;
```

Add after the `body { ... }` rule, at the end of the file:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Write `src/components/catalog/CategoryChips.tsx`**

```tsx
"use client";

import { CATEGORIES, type CatalogProduct } from "@/lib/catalog/types";

const CATEGORY_LABELS: Record<CatalogProduct["category"], string> = {
  FOUNDATION: "Foundation",
  BLUSH: "Blush",
  BRONZER: "Bronzer",
  HIGHLIGHTER: "Highlighter",
  EYESHADOW: "Eyeshadow",
  LIPSTICK: "Lipstick",
  SETTING_POWDER: "Setting Powder",
};

type Props = {
  active: CatalogProduct["category"] | "ALL";
  onChange: (category: CatalogProduct["category"] | "ALL") => void;
};

export function CategoryChips({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 py-3">
      <button
        onClick={() => onChange("ALL")}
        className={`shrink-0 rounded-pill px-4 py-2 text-xs font-semibold transition-colors ${
          active === "ALL" ? "bg-ink text-surface" : "bg-chip text-textSecondary"
        }`}
      >
        All
      </button>
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onChange(category)}
          className={`shrink-0 rounded-pill px-4 py-2 text-xs font-semibold transition-colors ${
            active === category ? "bg-ink text-surface" : "bg-chip text-textSecondary"
          }`}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/catalog/HeroBanner.tsx`**

```tsx
import Link from "next/link";
import { DESIGN_TOKENS } from "@/lib/tokens";

export function HeroBanner() {
  return (
    <div
      className="mx-5 my-4 rounded-card p-6 text-surface"
      style={{ background: DESIGN_TOKENS.gradients.heroBanner }}
    >
      <p className="font-display text-xl">Virtual Try-On</p>
      <p className="mt-1 text-sm text-textFaint">See it on your own face, live.</p>
      <div className="mt-4 flex gap-3">
        <Link
          href="/try-on"
          className="rounded-pill bg-accent px-4 py-2 text-xs font-semibold text-surface"
        >
          Virtual Try-On
        </Link>
        <Link
          href="/try-on"
          className="rounded-pill border border-surface/30 px-4 py-2 text-xs font-semibold text-surface"
        >
          Shade Match
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds (these components aren't wired into a page yet, but must type-check cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/catalog/CategoryChips.tsx src/components/catalog/HeroBanner.tsx
git commit -m "feat: add radius/animation tokens, CategoryChips, HeroBanner"
git push
```

---

### Task 4: ProductCard + ProductList

**Files:**
- Create: `src/components/catalog/ProductCard.tsx`
- Create: `src/components/catalog/ProductList.tsx`

**Interfaces:**
- Consumes: `CatalogProduct` from `@/lib/catalog/types` (Task 1).
- Produces: `ProductCard` (`product`, `onSelect` props), `ProductList` (`products`, `onSelect` props) — `onSelect(product: CatalogProduct) => void` is the exact signature `DiscoverView` (Task 5) and `SearchOverlay` (Task 5) will pass in.

- [ ] **Step 1: Write `src/components/catalog/ProductCard.tsx`**

```tsx
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";

type Props = {
  product: CatalogProduct;
  onSelect: (product: CatalogProduct) => void;
};

export function ProductCard({ product, onSelect }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <button
        onClick={() => onSelect(product)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <div
          className="h-14 w-14 shrink-0 rounded-card"
          style={{
            background: `linear-gradient(145deg, ${product.colorHex}cc, ${product.colorHex})`,
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{product.name}</p>
          <p className="truncate text-xs text-textSecondary">
            {product.shade} · <span className="text-accent">${product.price}</span>
          </p>
        </div>
        <div
          className="h-6 w-6 shrink-0 rounded-full"
          style={{
            backgroundColor: product.colorHex,
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
          }}
        />
      </button>
      <Link
        href="/try-on"
        className="shrink-0 rounded-pill bg-chip px-3 py-2 text-xs font-semibold text-ink"
      >
        Try On
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/catalog/ProductList.tsx`**

```tsx
import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

type Props = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
};

export function ProductList({ products, onSelect }: Props) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-textMuted">No products found</p>
    );
  }

  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelect} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/ProductCard.tsx src/components/catalog/ProductList.tsx
git commit -m "feat: add ProductCard and ProductList components"
git push
```

---

### Task 5: SearchOverlay + DiscoverView + wire up the Discover page

**Files:**
- Create: `src/components/catalog/SearchOverlay.tsx`
- Create: `src/components/catalog/DiscoverView.tsx`
- Modify: `src/app/(tabs)/discover/page.tsx`

**Interfaces:**
- Consumes: `searchProducts`, `filterByCategory` (Task 1); `ProductList` (Task 4); `CategoryChips`, `HeroBanner` (Task 3); `CatalogProduct`, `toCatalogProduct` (Task 1); `prisma` (Phase 1). Also consumes `ProductDetailSheet` from Task 6 — **Task 5 must be implemented after Task 6**, or `DiscoverView` will reference a component that doesn't exist yet. Reorder if executing strictly in sequence: do Task 6 before finishing Task 5's `DiscoverView` step, or stub the import and revisit. This plan lists Task 6 next specifically so its component exists before `DiscoverView` needs it — implementers following the checkbox order task-by-task should complete Task 6's steps 1-2 (creating `ProductDetailSheet`) before Task 5's Step 3 below.
- Produces: `DiscoverView` (default export not required — named export `DiscoverView({ products: CatalogProduct[] })`), wired as the sole child of the Discover page.

- [ ] **Step 1: Write `src/components/catalog/SearchOverlay.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { searchProducts } from "./filtering";
import { ProductList } from "./ProductList";

type Props = {
  products: CatalogProduct[];
  onClose: () => void;
  onSelect: (product: CatalogProduct) => void;
};

export function SearchOverlay({ products, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const results = searchProducts(products, query);

  return (
    <div className="fixed inset-0 z-60 bg-bg" style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-textFaint"
        />
        <button onClick={onClose} className="text-xs font-semibold text-textSecondary">
          Cancel
        </button>
      </div>
      <div className="overflow-y-auto">
        <ProductList products={results} onSelect={onSelect} />
      </div>
    </div>
  );
}
```

Note: Tailwind v4 doesn't have a built-in `z-60` scale step by default in all configs; if `npm run build` in Step 4 shows the class isn't generating a rule, replace `z-60` with an inline `style={{ zIndex: 60 }}` merged into the existing `style` prop instead. Verify in Step 4 before moving on.

- [ ] **Step 2: Write `src/components/catalog/DiscoverView.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { CategoryChips } from "./CategoryChips";
import { HeroBanner } from "./HeroBanner";
import { ProductList } from "./ProductList";
import { SearchOverlay } from "./SearchOverlay";
import { filterByCategory } from "./filtering";
import { ProductDetailSheet } from "@/components/detail/ProductDetailSheet";

type Props = {
  products: CatalogProduct[];
};

export function DiscoverView({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<CatalogProduct["category"] | "ALL">(
    "ALL"
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const visibleProducts = filterByCategory(products, activeCategory);

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6">
        <h1 className="font-display text-2xl text-ink">Discover</h1>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />
      <HeroBanner />
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
        <ProductDetailSheet
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Replace `src/app/(tabs)/discover/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { toCatalogProduct } from "@/lib/catalog/types";
import { DiscoverView } from "@/components/catalog/DiscoverView";

export default async function DiscoverPage() {
  const products = await prisma.product.findMany();
  const catalogProducts = products.map(toCatalogProduct);

  return (
    <main className="pb-6">
      <DiscoverView products={catalogProducts} />
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds. If the `z-60` class from Step 1 doesn't appear to apply (inspect generated CSS under `.next/` for a `.z-60` rule, same technique used in Phase 1's globals.css verification), switch `SearchOverlay`'s `className` to drop `z-60` and add `zIndex: 60` to its existing inline `style` object instead, then rebuild.

- [ ] **Step 5: Verify in the dev server**

```bash
npm run dev &
```

Visit `http://localhost:3000/discover`. Confirm: hero banner renders with dark gradient and two buttons; category chips scroll horizontally and toggle active state (ink background) on click, filtering the list below; tapping a product row opens the detail sheet (built in Task 6 — if Task 6 isn't done yet, this step fails and Task 6 must be completed first per the ordering note in this task's Interfaces section); tapping the search icon opens the full-screen overlay; typing filters results; "Try On" buttons and hero CTAs navigate to `/try-on`. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/catalog/SearchOverlay.tsx src/components/catalog/DiscoverView.tsx "src/app/(tabs)/discover/page.tsx"
git commit -m "feat: wire up Discover tab with search, chips, and hero banner"
git push
```

---

### Task 6: ProductDetailSheet + SimilarCarousel

**Files:**
- Create: `src/components/detail/ProductDetailSheet.tsx`
- Create: `src/components/detail/SimilarCarousel.tsx`

**Interfaces:**
- Consumes: `CatalogProduct` from `@/lib/catalog/types` (Task 1); `DESIGN_TOKENS` from `@/lib/tokens` (Phase 1); the `/api/products/[id]/similar` route (Task 2).
- Produces: `ProductDetailSheet` (`product`, `onClose` props) — this is the exact component `DiscoverView` (Task 5) imports from `@/components/detail/ProductDetailSheet`. **Complete this task before Task 5's Step 2-5**, since `DiscoverView` imports `ProductDetailSheet` directly.

- [ ] **Step 1: Write `src/components/detail/SimilarCarousel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";

type Props = {
  productId: string;
};

export function SimilarCarousel({ productId }: Props) {
  const [similar, setSimilar] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch(`/api/products/${productId}/similar`)
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then((data: CatalogProduct[]) => {
        if (!cancelled) setSimilar(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) {
    return <p className="mt-6 text-xs text-textMuted">Couldn&apos;t load similar products.</p>;
  }

  if (similar.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
        Similar From Other Brands
      </p>
      <div className="mt-2 flex gap-3 overflow-x-auto">
        {similar.map((p) => (
          <div key={p.id} className="shrink-0 text-center">
            <div
              className="h-14 w-14 rounded-full"
              style={{
                background: `linear-gradient(145deg, ${p.colorHex}cc, ${p.colorHex})`,
                boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
              }}
            />
            <p className="mt-1 w-16 truncate text-[10px] text-textSecondary">{p.brand}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/detail/ProductDetailSheet.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { DESIGN_TOKENS } from "@/lib/tokens";
import { SimilarCarousel } from "./SimilarCarousel";

type Props = {
  product: CatalogProduct;
  onClose: () => void;
};

export function ProductDetailSheet({ product, onClose }: Props) {
  const [saved, setSaved] = useState(false);
  const sephoraUrl = `https://www.sephora.com/search?keyword=${encodeURIComponent(
    `${product.brand} ${product.name}`
  )}`;

  return (
    <div className="fixed inset-0 z-70">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-surface p-6"
        style={{
          borderRadius: DESIGN_TOKENS.radii.sheet,
          animation: "slideUp 0.25s ease-out",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div
          className="mx-auto h-24 w-24 rounded-full"
          style={{
            background: `linear-gradient(145deg, ${product.colorHex}cc, ${product.colorHex})`,
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12)",
          }}
        />
        <h2 className="mt-4 text-center font-display text-xl text-ink">{product.name}</h2>
        <p className="mt-1 text-center text-sm text-textSecondary">
          {product.brand} · {product.shade}
        </p>
        <p className="mt-1 text-center text-lg font-semibold text-accent">${product.price}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[product.coverage, product.finish, product.skinType].map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-chip px-3 py-1 text-xs font-semibold text-textSecondary"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-textSecondary">{product.desc}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/try-on"
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface"
          >
            Try On
          </Link>
          <button
            onClick={() => setSaved((s) => !s)}
            aria-label={saved ? "Remove from saved" : "Save"}
            className="rounded-pill bg-chip px-4 py-3 text-sm font-semibold text-ink"
          >
            {saved ? "♥" : "♡"}
          </button>
        </div>
        <a
          href={sephoraUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-pill border border-border px-4 py-3 text-center text-sm font-semibold text-ink"
        >
          Buy on Sephora
        </a>
        <SimilarCarousel productId={product.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. If `z-70` doesn't generate a rule (same check as Task 5 Step 4), replace with inline `style={{ zIndex: 70 }}` merged into the outer `<div>`'s existing className-only usage (add a `style` prop).

- [ ] **Step 4: Commit**

```bash
git add src/components/detail/ProductDetailSheet.tsx src/components/detail/SimilarCarousel.tsx
git commit -m "feat: add ProductDetailSheet with similar-products carousel"
git push
```

- [ ] **Step 5: Now complete Task 5's Steps 2-6** (DiscoverView + page wiring), which depend on `ProductDetailSheet` existing.

---

## Self-Review

**Spec coverage:** Design doc decisions 1 (Try On = plain navigation, no state) — Task 4/6 `Link href="/try-on"` with no onClick side effects. Decision 2 (client-side filtering) — Task 5 `DiscoverView` filters in-memory via Task 1's pure functions. Decision 3 (API routes built + consumed by similar carousel) — Task 2 + Task 6 `SimilarCarousel`. Decision 4 (hero CTAs both to `/try-on`) — Task 3 `HeroBanner`. Decision 5 (heart toggle local-only) — Task 6 `useState(false)`, no fetch. Decision 6 (Sephora search link, no Official Site button) — Task 6, only one external link present. Decision 7 (logic-only tests) — Task 1 has all the test files; Tasks 2-6 verify via build/dev-server only. Decision 8 (empty search state) — `ProductList`'s "No products found" branch (Task 4), reused by both the category-filtered list and `SearchOverlay`'s results.

**Placeholder scan:** none — every step has literal code or exact commands.

**Type consistency:** `CatalogProduct` (Task 1) is the single product shape used everywhere — `ProductCard`, `ProductList`, `SearchOverlay`, `DiscoverView`, `ProductDetailSheet`, `SimilarCarousel`, and both non-list API routes all import it from `@/lib/catalog/types`, never redefine it. `onSelect: (product: CatalogProduct) => void` signature is identical in `ProductCard`, `ProductList`, `SearchOverlay`, and `DiscoverView`'s usage of all three.

**Ordering note:** Task 5 and Task 6 have a real interdependency (`DiscoverView` imports `ProductDetailSheet`) that doesn't fit the plan's linear numbering cleanly — flagged explicitly in both tasks' Interfaces sections with the exact resolution (finish Task 6 before Task 5's Step 2 onward).
