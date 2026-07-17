# Phase 2: Catalog API + Discover Tab — Design

CLAUDE.md is the primary spec (design tokens, data model, Discover tab layout, product
detail sheet UX). This document covers decisions CLAUDE.md leaves open, needed to build
Phase 2 of its roadmap: "Catalog API + Discover tab (chips, search overlay, detail sheet)."

## Context

- Phase 1 shipped: Next.js scaffold, Prisma + SQLite with 27 seeded products across all 7
  categories, design tokens wired into Tailwind, base 3-tab layout with bottom nav.
- No AR/try-on rendering exists yet (Phases 3-4). No saved-state persistence exists yet
  (Phase 9).

## Decisions

1. **Try On button behavior**: every "Try On" entry point (product card button, detail
   sheet primary button, both hero banner CTAs) is a plain `next/link` navigation to
   `/try-on`. No client state is recorded. The Try On tab continues to show its Phase 1
   stub heading until Phase 3+ builds real functionality there. (User-approved: simplest
   Phase 2 scope; layer-selection state gets built properly in Phase 5 when the Layer
   panel needs it.)
2. **Filtering strategy**: the Discover page Server Component
   (`src/app/(tabs)/discover/page.tsx`) queries `prisma.product.findMany()` directly and
   passes the full 27-product array to a client component. Category chips and the search
   overlay filter that array in-memory in the browser — no network round-trip per
   interaction. (User-approved.)
3. **Catalog API routes still get built** per CLAUDE.md's spec
   (`GET /api/products`, `GET /api/products/[id]`, `GET /api/products/[id]/similar`), but
   they are not what powers Discover's own chip/search filtering (see decision 2). They
   are genuinely consumed by the product detail sheet's "Similar From Other Brands"
   carousel, which fetches `/api/products/[id]/similar` on demand when a product is
   opened.
4. **Hero banner CTAs**: both "Virtual Try-On" and "Shade Match" buttons link to
   `/try-on`. Shade Match (Phase 8) doesn't exist yet; linking both to the same
   already-real destination avoids a dead link or a throwaway "coming soon" screen.
   (User-approved.)
5. **Heart-save toggle** on the product detail sheet is local component state only (no
   persistence, no API call) — it visually toggles filled/outline but resets on
   navigation. Real persistence is explicitly Phase 9's scope
   ("Saved looks/products... persist via API or local storage").
6. **"Buy on Sephora" / "Official Site" buttons**: the `Product` model has no buy-URL
   field (CLAUDE.md's data model doesn't include one). Rather than rendering dead
   buttons, these link to a generated Sephora search query:
   `https://www.sephora.com/search?keyword=${encodeURIComponent(`${brand} ${name}`)}`.
   "Official Site" is omitted in Phase 2 (no brand-website data exists to generate a
   meaningful link) rather than faking one.
7. **Test scope**: matches Phase 1 — pure filtering/search/similar-product-selection
   logic is extracted into standalone functions and unit-tested with vitest. No component
   rendering tests (no jsdom/React Testing Library added). UI correctness is verified by
   running the dev server, per CLAUDE.md's own guidance to check UI changes in a browser.
   (User-approved.)
8. **Empty search state**: plain "No products found" text in `textMuted`, distinct from
   the Saved tab's ♡ empty-state glyph (CLAUDE.md scopes that glyph specifically to
   Saved's empty state, not Discover's).

## Architecture

```
src/app/api/products/route.ts              GET (list, filtered)
src/app/api/products/[id]/route.ts         GET (single product, 404 if missing)
src/app/api/products/[id]/similar/route.ts GET (same category, different brand)

src/app/(tabs)/discover/page.tsx           Server Component: prisma.product.findMany()

src/components/catalog/
  DiscoverView.tsx      client component, owns state, composes everything below
  CategoryChips.tsx     "All" + 7 category chips
  HeroBanner.tsx         dark-gradient CTA card
  ProductList.tsx        maps filtered products to ProductCard
  ProductCard.tsx         thumbnail, name, shade·price, swatch, Try On button
  SearchOverlay.tsx      full-screen fadeIn overlay, filters in-memory
  filtering.ts           pure functions: filterByCategory, searchProducts

src/components/detail/
  ProductDetailSheet.tsx  bottom sheet, tag pills, description, heart toggle, buy links
  SimilarCarousel.tsx     fetches /api/products/[id]/similar on mount

src/lib/catalog/
  queryParams.ts          pure functions: parseProductQuery, validateProductQuery
  similar.ts              pure function: selectSimilarProducts(products, target)
```

## Data flow

1. `GET /discover` → Server Component queries Prisma → passes full array as props to
   `DiscoverView`.
2. `DiscoverView` holds `activeCategory`, `searchOpen`, `searchQuery`,
   `selectedProductId` state; derives the visible list via `filterByCategory` +
   `searchProducts` (both pure, unit-tested).
3. Tapping a product row (not its Try On button) sets `selectedProductId`, opening
   `ProductDetailSheet`. The sheet's `SimilarCarousel` fetches
   `/api/products/[id]/similar` client-side on open.
4. Tapping any "Try On" button or a hero banner CTA navigates to `/try-on` via
   `next/link` — no state change.

## Error handling

- API routes validate query params via `validateProductQuery` (bad `category` enum
  value, non-numeric `minPrice`/`maxPrice`) → `400 { error }`. Prisma calls wrapped in
  try/catch → `500 { error }` on failure.
- `GET /api/products/[id]` returns `404 { error: "Product not found" }` for an unknown
  id.
- `SimilarCarousel` shows an inline "Couldn't load similar products" message on fetch
  failure instead of breaking the rest of the detail sheet.
- Empty search results render the "No products found" text state (decision 8) instead
  of an empty list with no explanation.

## Testing

- `src/lib/catalog/queryParams.test.ts` — valid/invalid query param combinations.
- `src/lib/catalog/similar.test.ts` — same-category/different-brand selection, excludes
  the target product itself, handles a category with only one brand (empty result).
- `src/components/catalog/filtering.test.ts` — category filter, case-insensitive search
  across name/brand/shade, combined filter+search, empty-catalog edge case.
