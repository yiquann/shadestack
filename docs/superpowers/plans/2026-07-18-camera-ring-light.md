# Camera Ring Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable, functional screen-emitted fill light (a solid bright white ring around the live camera preview) so makeup colors read more accurately.

**Architecture:** Pure DOM/CSS change in `CameraSource.tsx`. A `ringLight` boolean local state gates (a) a solid `#FFFFFF` panel rendered behind the preview card with a soft outer bloom, showing as a ~28px bright band around the card, and (b) the visual state of a top-right pill toggle. No changes to the render/detection loop, landmarks, WebGL compositor, or masks.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Tailwind CSS v4 (design-token utilities).

## Global Constraints

- Colors only via design-token utility classes (`bg-surface`, `bg-ink`, `text-ink`, `text-surface`, `rounded-card`, `rounded-pill`). The ring fill is `surface` (`#FFFFFF`) — that token *is* the intended light color.
- The only exception is the ring's outer bloom, a functional translucent-white `box-shadow` (light spill, not a brand surface).
- TypeScript strict mode; no `any`.
- WebGL / render loop untouched — this is DOM/CSS only.
- Camera mode only (not Photo/Model).
- No new dependencies. No persistence (session-only state).

---

### Task 1: Ring light toggle + solid bright ring in CameraSource

**Files:**
- Modify: `src/components/tryon/CameraSource.tsx` — add `ringLight` state (near existing `const [fps, setFps] = useState(0);`, ~line 41) and restructure the preview JSX in the `return` (~lines 223–265).

**Interfaces:**
- Consumes: nothing new. Uses existing `useState`, existing token utility classes, existing `status`.
- Produces: nothing consumed elsewhere — fully local to the component.

**Why no unit test:** This repo's Vitest runs in a `node` environment over `.test.ts` logic files only; there is no jsdom/React-Testing-Library harness, and UI components here are verified by running the app. This task adds a pure DOM/CSS toggle with no logic branch worth a node-environment unit test, so verification is typecheck + lint + build + a visual check — consistent with the existing pattern (e.g. the FPS badge has no component test).

- [ ] **Step 1: Add `ringLight` state**

In `src/components/tryon/CameraSource.tsx`, immediately after the existing FPS state line:

```tsx
  const [fps, setFps] = useState(0);
  const [ringLight, setRingLight] = useState(false);
```

- [ ] **Step 2: Restructure the preview JSX to add the ring wrapper, ring panel, and toggle**

Replace the entire `return ( ... )` block (currently starting `return (` at ~line 223 and ending with the closing `);` at ~line 264) with:

```tsx
  return (
    <div>
      {/* Positioning wrapper — NOT overflow-hidden, so the ring panel and its
          bloom can extend outside the preview card. */}
      <div className="relative mx-auto w-full max-w-[380px]">
        {/* Ring light: a solid #FFFFFF panel behind the card, inset by -28px so a
            ~28px band of bright white shows around the rounded card; the box-shadow
            is a soft outer bloom that fades into the dark backdrop. Solid bright
            pixels emit real light that reflects onto the user's face. */}
        {ringLight && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-7 z-0 rounded-[28px] bg-surface"
            style={{ boxShadow: "0 0 60px 30px rgba(255,255,255,0.55)" }}
          />
        )}
        <div className="relative z-10 aspect-[3/4] w-full overflow-hidden rounded-card bg-ink">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={dividerRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ transform: "scaleX(-1)" }}
          />
          {SHOW_FPS && status === "ready" && (
            <span className="absolute left-2 top-2 rounded-pill bg-ink/60 px-2 py-1 text-[10px] font-semibold text-surface">
              {fps} fps
            </span>
          )}
          {status === "ready" && (
            <button
              type="button"
              onClick={() => setRingLight((v) => !v)}
              aria-pressed={ringLight}
              className={`pointer-events-auto absolute right-2 top-2 flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-semibold transition-all ${
                ringLight ? "bg-surface text-ink" : "bg-ink/60 text-surface"
              }`}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </svg>
              Ring Light
            </button>
          )}
        </div>
      </div>

      {status === "denied" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Camera access is needed for live try-on. Enable it in your browser settings.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          No camera available: {message}
        </p>
      )}
    </div>
  );
```

Key points to preserve during the edit:
- The `<video>` and both `<canvas>` elements keep their exact existing props (`ref`, `style={{ transform: "scaleX(-1)" }}`, class names, `width`/`height` on the render canvas).
- `overflow-hidden` moves from the old single card div onto the **inner** card div, so the ring panel (a sibling in the non-clipping wrapper) is not clipped.
- The card gets `relative z-10`; the ring panel is `z-0` — the video is never covered by the white band.
- The toggle uses `pointer-events-auto` because the surrounding canvases are `pointer-events-none`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). `ringLight`/`setRingLight` are typed `boolean`; no `any` introduced.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS with no new errors for `src/components/tryon/CameraSource.tsx`.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: Build succeeds (compiles the modified client component).

- [ ] **Step 6: Visual verification (run the app)**

Use the `run` skill (or `npm run dev`) to open the app, go to **Try On → Camera**, and confirm:
1. Toggle appears top-right of the preview; defaults **off**; no ring visible.
2. Tapping it shows a solid bright white ring + soft bloom around the card; the pill switches to the bright/active state (`bg-surface text-ink`).
3. Tapping again removes the ring; pill returns to the dark translucent state.
4. The video and composited makeup layers stay fully visible (card is never covered by the white band).
5. FPS badge (dev only) is unaffected; frame rate unchanged (the ring is static DOM/CSS outside the render loop).

- [ ] **Step 7: Commit**

```bash
git add src/components/tryon/CameraSource.tsx
git commit -m "feat: ring light toggle for camera try-on"
```

---

## Self-Review

**1. Spec coverage:**
- Functional fill light (solid bright pixels) → ring panel `bg-surface` + bloom. ✓
- Simple on/off toggle, default off → `ringLight` state + top-right pill. ✓
- Neutral white color temperature → `surface` (`#FFFFFF`), no warm tint. ✓
- Top-right placement (FPS owns top-left) → button `right-2 top-2`. ✓
- Camera-mode only, local state, no persistence → state lives in `CameraSource`, no props/localStorage. ✓
- No render-pipeline change → JSX/CSS only; loop untouched. ✓
- Layering (video never covered) → card `z-10` over panel `z-0`; `overflow-hidden` on inner card. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps. All JSX shown in full. ✓

**3. Type consistency:** `ringLight: boolean`, `setRingLight` updater used consistently; no cross-task signatures. ✓
