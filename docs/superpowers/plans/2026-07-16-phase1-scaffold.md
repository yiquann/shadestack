# Phase 1: Scaffold + Catalog Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Prisma project skeleton, populate a seed catalog, and ship the base 3-tab shell (Discover / Try On / Saved) with design tokens wired through Tailwind — the foundation every later phase builds on.

**Architecture:** Next.js App Router (TypeScript strict) scaffolded via `create-next-app`, Prisma ORM against SQLite for local dev (Postgres-compatible schema, swappable later), a single `src/lib/tokens.ts` as the canonical source for colors/typography/shape (CLAUDE.md Conventions: "Colors/spacing only via design tokens — never hardcode hex in components"), wired into Tailwind v4's CSS-first `@theme` config. Route group `(tabs)` holds the three tab pages behind a shared layout with the frosted bottom nav.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS v4, Prisma + SQLite (dev), Vitest for unit tests, `next/font/google` for DM Serif Display / DM Sans.

## Global Constraints

- TypeScript strict mode; no `any` in the render pipeline (render pipeline doesn't exist yet in Phase 1, but strict mode applies repo-wide from the start).
- Colors/spacing only via design tokens — never hardcode hex in components.
- `src/` directory layout must match the CLAUDE.md architecture tree.
- Design tokens (exact hex values, font names, radii, shadows) come verbatim from CLAUDE.md's "Design System" section — see Task 2 for the full table.
- `Category` enum values: `FOUNDATION, BLUSH, BRONZER, HIGHLIGHTER, EYESHADOW, LIPSTICK, SETTING_POWDER` (from CLAUDE.md Data Model).
- Package manager: npm. Database: SQLite locally via Prisma (`docs/superpowers/specs/2026-07-16-phase1-scaffold-design.md`).
- Commit style: conventional commits (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`).

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: entire `create-next-app` output (package.json, tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, public/*)
- The repo root already contains `CLAUDE.md`, `.gitignore`, `docs/`, `.claude/`, `.git/` — scaffold into a temp sibling directory and merge, so `create-next-app`'s non-empty-directory check never gets involved.

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`, `npm run build`, `npm run lint`) at the repo root, App Router under `src/app`, import alias `@/*` → `src/*`.

- [ ] **Step 1: Scaffold into a temp directory**

```bash
cd "C:/Users/sprin/AppData/Local/Temp"
npx create-next-app@latest shadestack-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Expected: command completes, `C:/Users/sprin/AppData/Local/Temp/shadestack-scaffold` contains a full Next.js project.

- [ ] **Step 2: Merge scaffold into the repo root**

```bash
cd "C:/Users/sprin/AppData/Local/Temp/shadestack-scaffold"
rm -rf .git
cp -r . "C:/Users/sprin/shadestack/"
rm -rf "C:/Users/sprin/AppData/Local/Temp/shadestack-scaffold"
```

Expected: `C:/Users/sprin/shadestack` now has `package.json`, `src/app/`, etc., alongside the pre-existing `CLAUDE.md`, `docs/`, `.gitignore`. The pre-existing `.gitignore` in the repo root is untouched by the copy only if `cp -r .` overwrites it — check afterward and restore the repo's `.gitignore` (it already includes `node_modules/`, `.next/`, `prisma/dev.db`, etc. — the scaffold's default `.gitignore` is a subset, so keep the repo's version):

```bash
cd "C:/Users/sprin/shadestack"
git diff --stat .gitignore
git checkout -- .gitignore
```

- [ ] **Step 3: Verify install, lint, build**

```bash
cd "C:/Users/sprin/shadestack"
npm install
npm run lint
npm run build
```

Expected: install succeeds, lint reports no errors, build completes (default Next.js starter page builds fine — it gets replaced in Task 5).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with TypeScript, Tailwind, App Router"
git push
```

---

### Task 2: Design tokens wired through Tailwind

**Files:**
- Create: `src/lib/tokens.ts`
- Create: `src/lib/tokens.test.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx` (load fonts)
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script + devDependencies)

**Interfaces:**
- Produces: `DESIGN_TOKENS` const from `src/lib/tokens.ts` with shape:
  ```ts
  export const DESIGN_TOKENS = {
    colors: {
      bg: string; ink: string; accent: string; accentHover: string;
      chip: string; chipHover: string; textSecondary: string;
      textMuted: string; textFaint: string; border: string; surface: string;
    },
    gradients: { cameraBackdrop: string; heroBanner: string },
    fonts: { display: string; body: string },
    radii: { card: string; pill: string; sheet: string },
    shadow: { card: string; cardHover: string },
  } as const;
  ```
  Later phases import colors/gradients/radii/shadow from here — never hardcode hex.
- Produces: Tailwind utility classes `bg-bg`, `text-ink`, `text-accent`, `bg-chip`, `text-textSecondary`, `text-textMuted`, `text-textFaint`, `border-border`, `bg-surface`, `font-display`, `font-body` via `@theme` in `globals.css`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add `test` script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write the failing test — `src/lib/tokens.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS } from "./tokens";

describe("DESIGN_TOKENS", () => {
  it("has the exact color values from the CLAUDE.md design system", () => {
    expect(DESIGN_TOKENS.colors.bg).toBe("#FAF6F2");
    expect(DESIGN_TOKENS.colors.ink).toBe("#1C1210");
    expect(DESIGN_TOKENS.colors.accent).toBe("#C4916C");
    expect(DESIGN_TOKENS.colors.accentHover).toBe("#A67656");
    expect(DESIGN_TOKENS.colors.chip).toBe("#F3E8E0");
    expect(DESIGN_TOKENS.colors.chipHover).toBe("#E8DDD4");
    expect(DESIGN_TOKENS.colors.textSecondary).toBe("#6B5E56");
    expect(DESIGN_TOKENS.colors.textMuted).toBe("#9A8B82");
    expect(DESIGN_TOKENS.colors.textFaint).toBe("#B8ADA5");
    expect(DESIGN_TOKENS.colors.border).toBe("#EDE5DD");
    expect(DESIGN_TOKENS.colors.surface).toBe("#FFFFFF");
  });

  it("has the two dark gradients", () => {
    expect(DESIGN_TOKENS.gradients.cameraBackdrop).toBe(
      "linear-gradient(160deg, #1a1410, #0f0c08, #1a1410)"
    );
    expect(DESIGN_TOKENS.gradients.heroBanner).toBe(
      "linear-gradient(135deg, #1C1210, #3B2518)"
    );
  });

  it("has display and body font families", () => {
    expect(DESIGN_TOKENS.fonts.display).toBe("DM Serif Display");
    expect(DESIGN_TOKENS.fonts.body).toBe("DM Sans");
  });

  it("every color value is a valid 6-digit hex", () => {
    for (const value of Object.values(DESIGN_TOKENS.colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx vitest run src/lib/tokens.test.ts
```

Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 6: Write `src/lib/tokens.ts`**

```ts
export const DESIGN_TOKENS = {
  colors: {
    bg: "#FAF6F2",
    ink: "#1C1210",
    accent: "#C4916C",
    accentHover: "#A67656",
    chip: "#F3E8E0",
    chipHover: "#E8DDD4",
    textSecondary: "#6B5E56",
    textMuted: "#9A8B82",
    textFaint: "#B8ADA5",
    border: "#EDE5DD",
    surface: "#FFFFFF",
  },
  gradients: {
    cameraBackdrop: "linear-gradient(160deg, #1a1410, #0f0c08, #1a1410)",
    heroBanner: "linear-gradient(135deg, #1C1210, #3B2518)",
  },
  fonts: {
    display: "DM Serif Display",
    body: "DM Sans",
  },
  radii: {
    card: "16px",
    pill: "20px",
    sheet: "24px 24px 0 0",
  },
  shadow: {
    card: "0 2px 8px rgba(28,18,16,0.07)",
    cardHover: "0 4px 14px rgba(28,18,16,0.12)",
  },
} as const;
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run src/lib/tokens.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 8: Wire tokens into Tailwind — replace `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --color-bg: #FAF6F2;
  --color-ink: #1C1210;
  --color-accent: #C4916C;
  --color-accent-hover: #A67656;
  --color-chip: #F3E8E0;
  --color-chip-hover: #E8DDD4;
  --color-text-secondary: #6B5E56;
  --color-text-muted: #9A8B82;
  --color-text-faint: #B8ADA5;
  --color-border: #EDE5DD;
  --color-surface: #FFFFFF;
  --font-display: "DM Serif Display", serif;
  --font-body: "DM Sans", sans-serif;
}

@theme inline {
  --color-bg: var(--color-bg);
  --color-ink: var(--color-ink);
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  --color-chip: var(--color-chip);
  --color-chip-hover: var(--color-chip-hover);
  --color-textSecondary: var(--color-text-secondary);
  --color-textMuted: var(--color-text-muted);
  --color-textFaint: var(--color-text-faint);
  --color-border: var(--color-border);
  --color-surface: var(--color-surface);
  --font-display: var(--font-display);
  --font-body: var(--font-body);
}

body {
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-body);
}
```

- [ ] **Step 9: Load fonts in `src/app/layout.tsx`**

Replace the default font imports (`Geist`/`Geist_Mono`) with:

```tsx
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "Shadestack — Virtual Beauty Try-On",
  description: "Real-time AR virtual makeup try-on",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSerifDisplay.variable} ${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Verify build still passes**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add design tokens and wire into Tailwind theme + fonts"
git push
```

---

### Task 3: Prisma schema + client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Modify: `package.json` (add `prisma`, `@prisma/client` deps, `db:migrate`/`db:generate` scripts)
- Modify: `.env` (DATABASE_URL) — create if absent, already gitignored

**Interfaces:**
- Produces: `prisma` singleton export from `src/lib/prisma.ts`:
  ```ts
  export const prisma: PrismaClient;
  ```
  Later phases (`Phase 2` catalog API) import this to query `Product`/`SavedLook`.
- Produces: generated `@prisma/client` types `Product`, `SavedLook`, `Category` (enum with the 7 values from Global Constraints).

- [ ] **Step 1: Install Prisma**

```bash
npm install -D prisma
npm install @prisma/client
```

- [ ] **Step 2: Write `.env`**

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Category {
  FOUNDATION
  BLUSH
  BRONZER
  HIGHLIGHTER
  EYESHADOW
  LIPSTICK
  SETTING_POWDER
}

model Product {
  id       String   @id @default(cuid())
  category Category
  name     String
  brand    String
  shade    String
  colorHex String
  price    Decimal
  coverage String
  finish   String
  skinType String
  desc     String
}

model SavedLook {
  id        String   @id @default(cuid())
  name      String
  layers    Json
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Write `src/lib/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Add scripts to `package.json`**

In `"scripts"`, add:

```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:seed": "tsx prisma/seed.ts"
```

(`tsx` is installed in Task 4, which also creates `prisma/seed.ts`.)

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<timestamp>_init/`, `prisma/dev.db` (gitignored), generates the Prisma client. Output ends with "Your database is now in sync with your schema."

- [ ] **Step 7: Verify client compiles**

```bash
npm run build
```

Expected: build succeeds (Prisma client is generated into `node_modules/.prisma`, importable from `src/lib/prisma.ts`).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/prisma.ts package.json package-lock.json .env.example
git commit -m "feat: add Prisma schema (Product, SavedLook) with SQLite datasource"
git push
```

Note: `.env` itself is gitignored (contains `DATABASE_URL`) — before this step, also create `.env.example` with the same `DATABASE_URL="file:./dev.db"` line so the connection string convention is documented in git, and add that file in the `git add`.

---

### Task 4: Seed catalog data

**Files:**
- Create: `prisma/seedData.ts` (plain data array, no DB dependency — testable in isolation)
- Create: `prisma/seedData.test.ts`
- Create: `prisma/seed.ts` (imports `seedData.ts`, writes to DB via Prisma)
- Modify: `package.json` (install `tsx`, add `"prisma": { "seed": "tsx prisma/seed.ts" }` block so `npx prisma db seed` works per CLAUDE.md's documented command)

**Interfaces:**
- Produces: `export const seedProducts: SeedProduct[]` from `prisma/seedData.ts`, where:
  ```ts
  type SeedProduct = {
    category: "FOUNDATION" | "BLUSH" | "BRONZER" | "HIGHLIGHTER" | "EYESHADOW" | "LIPSTICK" | "SETTING_POWDER";
    name: string; brand: string; shade: string; colorHex: string;
    price: number; coverage: string; finish: string; skinType: string; desc: string;
  };
  ```
  Phase 2's catalog API and Phase 5's "Complete Your Look" pairing logic rely on there being real spread across all 7 categories.

- [ ] **Step 1: Install `tsx`**

```bash
npm install -D tsx
```

- [ ] **Step 2: Write the failing test — `prisma/seedData.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { seedProducts } from "./seedData";

const CATEGORIES = [
  "FOUNDATION", "BLUSH", "BRONZER", "HIGHLIGHTER",
  "EYESHADOW", "LIPSTICK", "SETTING_POWDER",
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run prisma/seedData.test.ts
```

Expected: FAIL — `Cannot find module './seedData'`.

- [ ] **Step 4: Write `prisma/seedData.ts`**

```ts
export type SeedProduct = {
  category:
    | "FOUNDATION"
    | "BLUSH"
    | "BRONZER"
    | "HIGHLIGHTER"
    | "EYESHADOW"
    | "LIPSTICK"
    | "SETTING_POWDER";
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

export const seedProducts: SeedProduct[] = [
  // FOUNDATION
  { category: "FOUNDATION", name: "Luminous Silk Foundation", brand: "Giorgio Armani", shade: "4 Light", colorHex: "#E8C8A4", price: 68, coverage: "Medium", finish: "Luminous", skinType: "All skin types", desc: "A weightless foundation that blurs pores and evens tone with a lit-from-within glow." },
  { category: "FOUNDATION", name: "Pro Filt'r Soft Matte", brand: "Fenty Beauty", shade: "220", colorHex: "#D9A876", price: 40, coverage: "Full", finish: "Matte", skinType: "Oily", desc: "Long-wearing full coverage that controls shine without looking cakey." },
  { category: "FOUNDATION", name: "Double Wear Stay-in-Place", brand: "Estée Lauder", shade: "2W1.5 Natural Suede", colorHex: "#C99B72", price: 46, coverage: "Full", finish: "Matte", skinType: "Combination", desc: "24-hour wear foundation that resists heat, humidity, and sweat." },
  { category: "FOUNDATION", name: "Teint Idole Ultra Wear", brand: "Lancôme", shade: "310C", colorHex: "#B98A63", price: 52, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "Buildable coverage that stays fresh for 24 hours without feeling heavy." },

  // BLUSH
  { category: "BLUSH", name: "Cheek to Chic Blush", brand: "Charlotte Tilbury", shade: "Pillow Talk", colorHex: "#E8A0A0", price: 40, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A dual-tone blush that mimics the natural flush of glowing cheeks." },
  { category: "BLUSH", name: "Watercolour Blush", brand: "Clinique", shade: "Berry Pop", colorHex: "#D46A7E", price: 30, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A gel-cream blush that blends like a wash of watercolor." },
  { category: "BLUSH", name: "Soft Pinch Liquid Blush", brand: "Rare Beauty", shade: "Joy", colorHex: "#E88A9A", price: 23, coverage: "Buildable", finish: "Dewy", skinType: "All skin types", desc: "A weightless liquid blush that blends into a soft, healthy flush." },
  { category: "BLUSH", name: "Powder Blush", brand: "NARS", shade: "Orgasm", colorHex: "#E8927E", price: 32, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "The cult-classic peachy-pink blush with a golden shimmer." },

  // BRONZER
  { category: "BRONZER", name: "Hoola Matte Bronzer", brand: "Benefit", shade: "Original", colorHex: "#A87552", price: 32, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "A completely matte bronzer for natural-looking definition." },
  { category: "BRONZER", name: "Sun Dew Bronzing Serum", brand: "Fenty Beauty", shade: "Sun Stalla", colorHex: "#B87F55", price: 39, coverage: "Light", finish: "Dewy", skinType: "Dry", desc: "A hybrid bronzer-serum that melts into skin for a lit-from-within warmth." },
  { category: "BRONZER", name: "Soleil Tan de Chanel", brand: "Chanel", shade: "Universel", colorHex: "#C08A5E", price: 62, coverage: "Buildable", finish: "Luminous", skinType: "All skin types", desc: "A silky bronzing powder for a healthy, sun-kissed complexion." },
  { category: "BRONZER", name: "Terracotta Light Bronzer", brand: "Guerlain", shade: "01 Light Warm", colorHex: "#BC8863", price: 55, coverage: "Buildable", finish: "Matte", skinType: "All skin types", desc: "An iconic bronzing powder with a natural, sculpted warmth." },

  // HIGHLIGHTER
  { category: "HIGHLIGHTER", name: "Killawatt Freestyle Highlighter", brand: "Fenty Beauty", shade: "Trophy Wife", colorHex: "#F0D8B8", price: 38, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "An intensely pigmented highlighter for a metallic, sculpted glow." },
  { category: "HIGHLIGHTER", name: "Strobe Cream", brand: "MAC", shade: "Silverlite", colorHex: "#EFE2D6", price: 34, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A luminizing cream that adds a soft, radiant sheen to skin." },
  { category: "HIGHLIGHTER", name: "Glow Kit", brand: "Anastasia Beverly Hills", shade: "Sun Dipped", colorHex: "#EAC9A0", price: 40, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A finely-milled powder highlighter for an intense golden glow." },
  { category: "HIGHLIGHTER", name: "Hydra Glow Highlighting Powder", brand: "NARS", shade: "Fort de France", colorHex: "#F2DCC2", price: 46, coverage: "Light", finish: "Luminous", skinType: "Dry", desc: "A hydrating highlighter that leaves skin looking dewy and refreshed." },

  // EYESHADOW
  { category: "EYESHADOW", name: "Naked Eyeshadow Palette", brand: "Urban Decay", shade: "Buzz", colorHex: "#C9A876", price: 21, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A warm bronze shimmer shade for a sultry, smoky look." },
  { category: "EYESHADOW", name: "Modern Renaissance Palette", brand: "Anastasia Beverly Hills", shade: "Vermeer", colorHex: "#8B4A3D", price: 12, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A deep burnt-red matte shade perfect for warm smoky eyes." },
  { category: "EYESHADOW", name: "Eyeshadow Quad", brand: "Chanel", shade: "Tisse Venise", colorHex: "#B08968", price: 64, coverage: "Buildable", finish: "Shimmer", skinType: "All skin types", desc: "A coordinated quad of golden-taupe shades for effortless definition." },
  { category: "EYESHADOW", name: "Mono Eyeshadow", brand: "Pat McGrath Labs", shade: "Bronze Ambition", colorHex: "#A6693E", price: 25, coverage: "Full", finish: "Shimmer", skinType: "All skin types", desc: "A richly pigmented single shade with a metallic foil finish." },

  // LIPSTICK
  { category: "LIPSTICK", name: "Rouge Pur Couture", brand: "Yves Saint Laurent", shade: "1 Le Rouge", colorHex: "#B23A3A", price: 39, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A vivid matte red with a comfortable, non-drying formula." },
  { category: "LIPSTICK", name: "Soft Matte Lip Cream", brand: "NARS", shade: "Rikugien", colorHex: "#C4726B", price: 28, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A featherweight liquid lipstick with an ultra-matte, non-drying finish." },
  { category: "LIPSTICK", name: "Lip Glow Balm", brand: "Dior", shade: "004 Coral", colorHex: "#E37B6D", price: 40, coverage: "Light", finish: "Dewy", skinType: "All skin types", desc: "A tinted lip balm that adapts to your natural lip tone with a glossy finish." },
  { category: "LIPSTICK", name: "Matte Revolution Lipstick", brand: "Charlotte Tilbury", shade: "Pillow Talk", colorHex: "#C48A80", price: 38, coverage: "Full", finish: "Matte", skinType: "All skin types", desc: "A nude-pink matte lipstick with a soft-focus, blurring effect." },

  // SETTING_POWDER
  { category: "SETTING_POWDER", name: "Airspun Loose Powder", brand: "Coty", shade: "Translucent", colorHex: "#F2E4D2", price: 8, coverage: "Light", finish: "Matte", skinType: "All skin types", desc: "A classic finely-milled loose powder that sets makeup without adding color." },
  { category: "SETTING_POWDER", name: "All Nighter Setting Powder", brand: "Urban Decay", shade: "Translucent", colorHex: "#F0E2D0", price: 39, coverage: "Light", finish: "Matte", skinType: "Oily", desc: "A weightless powder that locks makeup in place for up to 16 hours." },
  { category: "SETTING_POWDER", name: "Fix Powder+", brand: "Charlotte Tilbury", shade: "Universal", colorHex: "#F3E6D6", price: 42, coverage: "Light", finish: "Luminous", skinType: "All skin types", desc: "A glow-boosting setting powder that blurs and brightens without flashback." },
];
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run prisma/seedData.test.ts
```

Expected: PASS (5 tests). If the "at least 3 per category" test fails for any category, add more entries to that category following the same shape until it passes.

- [ ] **Step 6: Write `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { seedProducts } from "./seedData";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany();
  for (const product of seedProducts) {
    await prisma.product.create({ data: product });
  }
  console.log(`Seeded ${seedProducts.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 7: Add `prisma.seed` config to `package.json`**

Add a top-level key (sibling to `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 8: Run the seed**

```bash
npx prisma db seed
```

Expected output: `Seeded 26 products.` (or however many entries are in `seedProducts`), no errors.

- [ ] **Step 9: Verify against the live DB**

```bash
npx prisma studio --browser none &
```

Or simpler — a one-off query script isn't needed; trust the seed script's own console output plus the Step 5 unit tests, which already validate the data shape before it touches the DB. Kill any `prisma studio` process started above.

- [ ] **Step 10: Commit**

```bash
git add prisma/seedData.ts prisma/seedData.test.ts prisma/seed.ts package.json package-lock.json
git commit -m "feat: add hand-authored seed catalog (26 products across 7 categories)"
git push
```

---

### Task 5: Base layout, bottom nav, and tab route stubs

**Files:**
- Create: `src/components/nav/BottomNav.tsx`
- Create: `src/app/(tabs)/layout.tsx`
- Create: `src/app/(tabs)/discover/page.tsx`
- Create: `src/app/(tabs)/try-on/page.tsx`
- Create: `src/app/(tabs)/saved/page.tsx`
- Modify: `src/app/page.tsx` (redirect `/` → `/discover`)
- Delete: default `src/app/favicon.ico`-adjacent starter content is fine to leave; only `page.tsx` content changes.

**Interfaces:**
- Consumes: `DESIGN_TOKENS` from `src/lib/tokens.ts` (Task 2) for the frosted bar color/blur values.
- Produces: three routes (`/discover`, `/try-on`, `/saved`) sharing `BottomNav`, ready for Phase 2+ to fill in.

- [ ] **Step 1: Write `src/components/nav/BottomNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/discover", label: "Discover" },
  { href: "/try-on", label: "Try On" },
  { href: "/saved", label: "Saved" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-border py-3 backdrop-blur-md"
      style={{ backgroundColor: "rgba(250,246,242,0.97)" }}
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-xs font-semibold transition-colors"
            style={{ color: active ? "#C4916C" : "#B8ADA5" }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Write `src/app/(tabs)/layout.tsx`**

```tsx
import { BottomNav } from "@/components/nav/BottomNav";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Write the three tab stub pages**

`src/app/(tabs)/discover/page.tsx`:

```tsx
export default function DiscoverPage() {
  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-2xl text-ink">Discover</h1>
    </main>
  );
}
```

`src/app/(tabs)/try-on/page.tsx`:

```tsx
export default function TryOnPage() {
  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-2xl text-ink">Try On</h1>
    </main>
  );
}
```

`src/app/(tabs)/saved/page.tsx`:

```tsx
export default function SavedPage() {
  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-2xl text-ink">Saved</h1>
    </main>
  );
}
```

- [ ] **Step 4: Redirect root to `/discover` — replace `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/discover");
}
```

- [ ] **Step 5: Verify in the dev server**

```bash
npm run dev &
```

Visit `http://localhost:3000/` — expect redirect to `/discover` showing "Discover" heading in serif font, frosted bottom nav with "Discover" highlighted in accent color (`#C4916C`) and "Try On"/"Saved" in faint gray (`#B8ADA5`). Click each tab, confirm the active tab color follows the current route and the page renders its heading. Stop the dev server after confirming.

- [ ] **Step 6: Verify build + lint + typecheck + tests all pass**

```bash
npm run lint
npm run build
npx vitest run
```

Expected: all three succeed with zero errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add base layout with frosted bottom nav and tab route stubs"
git push
```

---

## Self-Review

**Spec coverage:** CLAUDE.md Phase-1 roadmap item ("Scaffold Next.js + Prisma; seed catalog from prototype products[] data") — covered by Tasks 1, 3, 4 (seed source substituted per approved design addendum). "Colors/spacing only via design tokens" convention — covered by Task 2 + enforced by Task 5 using `DESIGN_TOKENS`-derived Tailwind classes. "3 bottom tabs... frosted bar... active tab in accent, inactive in textFaint" — covered by Task 5. `src/` architecture tree from CLAUDE.md — matched (`components/nav`, `lib/tokens.ts`, `lib/prisma.ts`, `prisma/schema.prisma`). TypeScript strict mode — default from `create-next-app --typescript`, verified via `tsc` inside `npm run build`.

**Placeholder scan:** none — every step has literal code or exact commands with expected output.

**Type consistency:** `SeedProduct.category` union in Task 4 matches the `Category` enum values from Task 3 exactly. `DESIGN_TOKENS` shape defined in Task 2 is the only shape referenced later (Task 5 uses raw hex matching those values directly since Tailwind's `@theme` custom color names aren't guaranteed stable across environments in this plan — using inline `style` for now is deliberate, not an inconsistency, and can be revisited once Tailwind's generated utility names are confirmed at build time).
