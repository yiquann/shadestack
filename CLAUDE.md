# CLAUDE.md — Virtual Beauty Try-On

## Project Overview

A real-time AR virtual makeup try-on web app. Users browse a cosmetic product catalog, apply products as composited layers onto a live camera feed (or an uploaded photo / illustrated model face), compare two looks side-by-side, and save looks/products to a personal collection.

All face tracking and compositing runs **on-device** — no frames are ever sent to a server. Target: **30+ fps** on mid-range mobile hardware.

A high-fidelity interactive prototype exists (`Virtual_Beauty_Try-On.html`) and is the **source of truth for UX and visual design**. This codebase is the production implementation of that prototype.

## Core Features

1. **Real-time AR compositing** — MediaPipe Face Mesh landmarks drive WebGL rendering that composites product layers (foundation, blush, bronzer, highlighter, eyeshadow, lipstick, setting powder) onto the live camera feed using blend modes (`multiply` for pigment, `screen` for highlight/glow). All processing on-device, 30+ fps.
2. **Layer management** — Interactive panel with drag-to-reorder, per-layer opacity slider, visibility toggling, and removal. Rendering is zone-based across **six facial regions**: cheeks, forehead/temples, eyes (lids), lips, nose/center highlight, jawline/perimeter.
3. **Split-view comparison (Look A / Look B)** — Renders two product combinations simultaneously across mirrored facial regions for real-time A/B evaluation on the user's own skin tone. Tap a side to make it the active edit target.
4. **Product catalog API** — Filterable, multi-attribute search (category, brand, shade, finish, coverage, skin type, price) served through Next.js API routes with Prisma + PostgreSQL.
5. **Shade match** — Camera capture → skin-tone analysis → ranked foundation matches ("Best Match" carousel).
6. **Saved collection** — Save individual products (heart) and complete looks (named product combinations); re-apply a saved look with one tap.

## Tech Stack

- **Framework:** Next.js (App Router), TypeScript, React
- **Face tracking:** MediaPipe Face Mesh (`@mediapipe/tasks-vision` FaceLandmarker) — 468 landmarks, runs client-side via WASM/WebGL delegate
- **Rendering:** WebGL (canvas layered over `<video>`); custom fragment shaders implementing multiply/screen blend modes per zone; landmark-driven zone masks with feathered edges (Gaussian falloff)
- **Backend:** Next.js API routes, Prisma ORM, PostgreSQL
- **State:** React state/hooks; keep try-on session state client-side (layers, visibility, opacity, compare mode)
- **Styling:** CSS-in-JS or Tailwind — but must reproduce the design tokens below exactly

## Architecture Notes

```
src/
  app/
    (tabs)/            # Discover, Try On, Saved
    api/products/      # catalog API (list, search, filter, similar)
  components/
    tryon/             # CameraCanvas, FaceMeshTracker, LayerRenderer, SplitView
    layers/            # LayerPanel, LayerRow (drag handle, opacity, toggle, remove)
    catalog/           # ProductList, ProductCard, CategoryChips, SearchOverlay
    detail/            # ProductDetailSheet (bottom sheet)
    shade/             # ShadeMatchOverlay, MatchCarousel
  lib/
    facemesh/          # landmark utils, zone polygon definitions (6 regions)
    webgl/             # shader sources, blend-mode pipeline, texture mgmt
  prisma/
    schema.prisma
```

- **Render pipeline:** video frame → FaceLandmarker → zone masks (from landmark subsets) → per-layer shader pass in layer order (bottom = foundation, top = lipstick by default; user can reorder) → composite to canvas. Use `requestVideoFrameCallback` where available; degrade gracefully to 24fps before dropping resolution.
- **Split view:** one tracker, two render passes with different layer sets, drawn to mirrored halves (or two small canvases in prototype-style card layout).
- **Photo mode:** same pipeline on a static image (single landmark pass, cached masks).
- **Privacy:** never upload camera frames or photos. Shade match analysis runs locally; only the resulting shade result may be used to query the catalog API.

## Data Model (Prisma)

```prisma
model Product {
  id        String   @id @default(cuid())
  category  Category            // FOUNDATION, BLUSH, BRONZER, HIGHLIGHTER, EYESHADOW, LIPSTICK, SETTING_POWDER
  name      String              // "Luminous Silk Foundation"
  brand     String              // "Giorgio Armani"
  shade     String              // "4 Light"
  colorHex  String              // "#E8C8A4" — drives the render tint + swatch UI
  price     Decimal
  coverage  String              // "Medium", "Full", "Buildable", "Light"
  finish    String              // "Matte", "Luminous", "Shimmer", "Dewy", ...
  skinType  String              // "All skin types", ...
  desc      String
}

model SavedLook {
  id        String   @id @default(cuid())
  name      String              // "Natural Everyday"
  layers    Json                // { category: productId } map
  createdAt DateTime @default(now())
}
```

API routes: `GET /api/products` (with `?category=&brand=&q=&finish=&coverage=&minPrice=&maxPrice=`), `GET /api/products/[id]`, `GET /api/products/[id]/similar` (same category, different brand).

## Design System (from prototype — follow exactly)

### Colors
| Token | Hex | Use |
|---|---|---|
| `bg` | `#FAF6F2` | App background (warm cream) |
| `ink` | `#1C1210` | Primary text, active chip bg |
| `accent` | `#C4916C` | Primary buttons, active tab, prices, links (caramel) |
| `accentHover` | `#A67656` | Button hover/press |
| `chip` | `#F3E8E0` | Inactive chips, icon buttons, tag pills |
| `chipHover` | `#E8DDD4` | Chip hover |
| `textSecondary` | `#6B5E56` | Product meta, body copy |
| `textMuted` | `#9A8B82` | Section labels, subtitles |
| `textFaint` | `#B8ADA5` | Empty states, inactive tab icons |
| `border` | `#EDE5DD` | Hairline borders, outlined buttons |
| `surface` | `#FFFFFF` | Cards |
| `darkGradient` | `linear-gradient(160deg, #1a1410, #0f0c08, #1a1410)` | Camera/photo backdrops, hero banner (`135deg, #1C1210 → #3B2518`) |

### Typography
- **Display / headings:** `DM Serif Display` (page titles 22–26px, detail titles 19px)
- **UI / body:** `DM Sans` (weights 400–700)
- **Section labels:** 10–11px, weight 700, uppercase, `letter-spacing: 0.8px`, color `textMuted`

### Shape & elevation
- Cards: `border-radius: 14–16px`, shadow `0 2px 8px rgba(28,18,16,0.07)`; hover lifts to `0 4px 14px rgba(28,18,16,0.12)` + `translateY(-1px)`
- Pills/chips: fully rounded (`14–20px` radius), 11–12px semibold text
- Bottom sheet: `border-radius: 24px 24px 0 0`, drag handle bar, `slideUp 0.25s ease-out`, dimmed scrim `rgba(28,18,16,0.3)`
- Swatches: circular, `box-shadow: inset 0 -3px 6px rgba(0,0,0,0.12)` for a domed-pan effect
- Product thumbnails: rounded square with `linear-gradient(145deg, lightened(colorHex), colorHex)` + inset highlights + tiny brand-initial label

### Animations
`slideUp` (sheets), `fadeIn 0.15–0.2s` (overlays), `pulse 1.5s` (face-tracking landmark dots), `spin 0.8s` (shade-match loader). Transitions on interactive elements: `all 0.15s`.

### Layout & navigation
- Mobile-first, single column (~393px design width), generous 20px horizontal padding
- **3 bottom tabs:** Discover · Try On · Saved — frosted bar (`rgba(250,246,242,0.97)` + `backdrop-filter: blur(12px)`), active tab in `accent`, inactive in `textFaint`
- **Discover:** title + search/camera icon buttons → horizontal category chips → dark hero banner ("Virtual Try-On / Shade Match" CTA) → product list rows (thumbnail, name, shade · price, swatch, "Try On" button)
- **Try On:** title + Split View toggle + Save Look → segmented face-source picker (**Model | Photo | Camera**) → face preview → Active Layers list (swatch, name, category, visibility toggle, remove ✕) → "Complete Your Look" pairing suggestions (horizontal swatch carousel) → category chips + search + Add Products list
- **Saved:** Saved Looks (horizontal cards with overlapping swatch stacks, name, count · date) → Saved Products list; empty state uses ♡ glyph
- **Product detail:** bottom sheet — large swatch, serif title, brand · shade, price in accent, tag pills (coverage / finish / skin type), description, primary "Try On" + heart save, outlined "Buy on Sephora" / "Official Site", "Similar From Other Brands" carousel
- **Camera overlay:** full-screen dark, dashed face-outline guide with pulsing landmark dots, capture button (62px accent circle with glow ring), Close / Flip; results slide up as a frosted "Best Matches" carousel with the top result outlined in accent

### UX behaviors to preserve
- One product per category per look (adding a foundation replaces the current foundation)
- Adding a product in compare mode applies to the **active side** only
- Toggling Split View copies Look A into Look B as the starting point
- "Complete Your Look" suggests complementary categories (foundation → blush/bronzer, lipstick → blush/eyeshadow, etc.) excluding already-applied categories
- Photo mode prompts: "Use a well-lit selfie with no makeup for the most accurate try-on results"

## Rendering Fidelity Targets

Per-category compositing (baseline values from prototype; tune with real landmarks):
- **Foundation:** full-face tint, multiply, ~0.15–0.20 opacity
- **Setting powder:** full-face, multiply, ~0.06 opacity
- **Blush:** cheek zones, multiply, ~0.70 opacity, heavy feather/blur
- **Bronzer:** temples + jawline, multiply, ~0.48, heaviest blur
- **Highlighter:** cheekbones + nose bridge, **screen**, ~0.20–0.30
- **Eyeshadow:** lid zones, multiply, ~0.32, tight feather
- **Lipstick:** lip zone (landmark-precise), multiply, ~0.55

Per-layer opacity slider scales these baselines (0–100%) — each value above is
the **ceiling** reached at 100%, not a fixed amount.

Note on tuning these: a multiply layer resolves to `dst * (1 - a*(1 - colour))`,
so perceived strength is driven by `opacity x (1 - colour)` — how far the pigment
sits from white. Pale swatches therefore need a higher opacity than saturated
ones to read at all, which is why blush/bronzer sit above the prototype's
original 0.32/0.18. Raising opacity darkens every channel together; for pigments
whose hue is close to the skin's (bronzer especially) it dims more than it warms.

## Conventions

- TypeScript strict mode; no `any` in the render pipeline
- Colors/spacing only via design tokens — never hardcode hex in components
- WebGL code isolated in `lib/webgl`; components never touch GL directly
- Keep the FaceLandmarker instance a singleton; dispose on unmount
- Prefer server components for catalog pages; try-on is fully client (`"use client"`)
- Commit style: conventional commits (`feat:`, `fix:`, `perf:`, `refactor:`)

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npx prisma migrate dev   # apply schema changes
npx prisma db seed       # seed catalog (port products[] from prototype)
npm run lint && npm run typecheck
```

## Roadmap (suggested build order)

1. Scaffold Next.js + Prisma; seed catalog from prototype `products[]` data
2. Catalog API + Discover tab (chips, search overlay, detail sheet)
3. FaceLandmarker integration + illustrated **Model** face fallback
4. WebGL layer renderer, one zone (lips) end-to-end, then remaining five zones
5. Layer panel: toggle → opacity → drag-to-reorder
6. Photo mode, then live Camera mode (perf pass to hit 30fps)
7. Split-view comparison
8. Shade match analysis + Best Matches carousel
9. Saved looks/products (persist via API or local storage)
