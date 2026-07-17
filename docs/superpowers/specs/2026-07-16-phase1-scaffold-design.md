# Phase 1: Scaffold + Catalog Seed — Design Addendum

CLAUDE.md is the primary spec (design tokens, data model, architecture, roadmap). This
addendum only covers decisions CLAUDE.md leaves open, needed to start Phase 1 of its
roadmap: "Scaffold Next.js + Prisma; seed catalog from prototype `products[]` data."

## Context

- Repo is empty except CLAUDE.md. No prototype HTML file (`Virtual_Beauty_Try-On.html`)
  is present, despite CLAUDE.md referencing it as source of truth.
- Decision (user-approved): build from CLAUDE.md's written design tokens/layout specs
  directly; generate a hand-written seed catalog instead of porting one.

## Decisions

1. **Database**: SQLite for local dev via Prisma (`provider = "sqlite"`). Schema stays
   Prisma-idiomatic and Postgres-compatible (no SQLite-only types); switching
   `provider` + `DATABASE_URL` is the only change needed to move to real Postgres later.
   Known caveat: `Product.price Decimal` has no native fixed-point type on SQLite
   (stored via NUMERIC/REAL affinity), so non-whole-cent values could lose precision
   in local dev. Accepted for now — the field stays `Decimal` per CLAUDE.md's data
   model rather than deviating to an `Int` cents representation; switching to
   Postgres restores exact `Decimal` semantics.
2. **Package manager**: npm (already present, no lockfile conflicts to resolve).
3. **Seed catalog**: hand-authored, ~18-20 products spread across all 7 `Category`
   enum values (FOUNDATION, BLUSH, BRONZER, HIGHLIGHTER, EYESHADOW, LIPSTICK,
   SETTING_POWDER), 3-4 per category minimum so catalog filtering/search and
   "Complete Your Look" pairing logic have real data to exercise. Realistic-sounding
   brand/shade/price/colorHex values (colorHex must be genuine hex matching the
   product's described shade, since it drives swatch rendering).
4. **Next.js setup**: App Router, TypeScript strict mode, `src/` directory layout
   matching the CLAUDE.md architecture tree exactly.

## Scope of Phase 1

- `npx create-next-app` scaffold (TS, App Router, no Tailwind decision deferred to
  design-system pass — CLAUDE.md allows CSS-in-JS or Tailwind).
- Prisma schema per CLAUDE.md's `Product` / `SavedLook` models + `Category` enum.
- Seed script (`prisma/seed.ts`) populating the catalog.
- Design tokens file (colors/typography/shape from CLAUDE.md's Design System section)
  as the single source components will import from — no hardcoded hex in components,
  per CLAUDE.md Conventions.
- Base layout with the 3-tab frosted bottom nav (Discover / Try On / Saved), empty
  route stubs for each tab.

Everything else (catalog API, face tracking, WebGL, etc.) is out of scope for Phase 1
and will get its own addendum spec only if a decision arises that CLAUDE.md doesn't
already answer — otherwise phases proceed straight to an implementation plan.
