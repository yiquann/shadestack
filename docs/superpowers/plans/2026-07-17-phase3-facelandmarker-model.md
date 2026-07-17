# Phase 3: FaceLandmarker + Model Face Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate MediaPipe's FaceLandmarker (client-side, singleton) and prove it works end-to-end against a bundled illustrated "Model" face, with the Model | Photo | Camera segmented picker stubbed for Photo/Camera.

**Architecture:** A module-level singleton (`getFaceLandmarker()`) lazily loads MediaPipe's WASM runtime and model file from Google's CDN once per session. A `useFaceLandmarks` hook runs a single `detect()` pass against an `<img>` element once it loads, returning a small state union (loading/detected/no-face/error). `FaceMeshTracker` composes the bundled SVG face image with that hook and a canvas overlay that plots a pulsing dot per landmark — the visual proof the pipeline works.

**Tech Stack:** `@mediapipe/tasks-vision` (FaceLandmarker, `runningMode: "IMAGE"`, GPU delegate), React hooks, Tailwind v4, Playwright for verification (no vitest — this can't run in a WASM-less test environment).

## Global Constraints

- TypeScript strict mode; no `any`.
- Colors/spacing only via design tokens — never hardcode hex in components.
- Keep the FaceLandmarker instance a singleton; dispose on unmount means cancelling in-flight per-component work, not destroying the shared model instance (see design doc decision 4).
- `@mediapipe/tasks-vision` npm version installed: **0.10.35** — the CDN URLs below must use this exact version so the JS API and WASM binary stay in sync. If a different version resolves at install time, update both CDN URL occurrences in `src/lib/facemesh/faceLandmarker.ts` to match.
- This phase's illustrated face + detection approach was already spiked and confirmed working (1 face, 478 landmark points detected) before this plan was written — see `docs/superpowers/specs/2026-07-17-phase3-facelandmarker-model-design.md` decision 3.
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`).

---

### Task 1: FaceLandmarker singleton + detection hook

**Files:**
- Create: `src/lib/facemesh/faceLandmarker.ts`
- Create: `src/lib/facemesh/useFaceLandmarks.ts`

**Interfaces:**
- Produces: `getFaceLandmarker(): Promise<FaceLandmarker>` — lazy module-level singleton.
- Produces: `FaceLandmarksState` union type and `useFaceLandmarks(imageRef: RefObject<HTMLImageElement | null>, imageLoaded: boolean): FaceLandmarksState`, where:
  ```ts
  type FaceLandmarksState =
    | { status: "loading" }
    | { status: "detected"; points: { x: number; y: number }[] }
    | { status: "no-face" }
    | { status: "error"; message: string };
  ```
  Task 3's `FaceMeshTracker` consumes this exact hook and type — no renaming.

- [ ] **Step 1: Install the package**

```bash
npm install @mediapipe/tasks-vision@0.10.35
```

- [ ] **Step 2: Write `src/lib/facemesh/faceLandmarker.ts`**

```ts
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createFaceLandmarker();
  }
  return landmarkerPromise;
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });
}
```

- [ ] **Step 3: Write `src/lib/facemesh/useFaceLandmarks.ts`**

```ts
"use client";

import { useEffect, useState, type RefObject } from "react";
import { getFaceLandmarker } from "./faceLandmarker";

export type FaceLandmarksState =
  | { status: "loading" }
  | { status: "detected"; points: { x: number; y: number }[] }
  | { status: "no-face" }
  | { status: "error"; message: string };

export function useFaceLandmarks(
  imageRef: RefObject<HTMLImageElement | null>,
  imageLoaded: boolean
): FaceLandmarksState {
  const [state, setState] = useState<FaceLandmarksState>({ status: "loading" });

  useEffect(() => {
    if (!imageLoaded) return;
    let cancelled = false;

    async function run() {
      try {
        const landmarker = await getFaceLandmarker();
        const img = imageRef.current;
        if (!img || cancelled) return;
        const result = landmarker.detect(img);
        if (cancelled) return;
        const face = result.faceLandmarks[0];
        if (!face || face.length === 0) {
          setState({ status: "no-face" });
          return;
        }
        setState({ status: "detected", points: face.map((p) => ({ x: p.x, y: p.y })) });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Detection failed",
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [imageRef, imageLoaded]);

  return state;
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds. Nothing consumes these files yet (Task 3 wires them up), so this only checks they compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/facemesh/faceLandmarker.ts src/lib/facemesh/useFaceLandmarks.ts package.json package-lock.json
git commit -m "feat: add FaceLandmarker singleton and detection hook"
git push
```

---

### Task 2: Model face SVG asset + pulse animation token

**Files:**
- Create: `public/model-face.svg`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: a static asset at `/model-face.svg`, 500×600, already verified to be detected by MediaPipe (1 face, 478 landmarks) during this plan's design spike.
- Produces: CSS `@keyframes pulse` for Task 3's landmark-dot overlay to reference (CLAUDE.md: "pulse 1.5s (face-tracking landmark dots)").

- [ ] **Step 1: Write `public/model-face.svg`**

```svg
<svg width="500" height="600" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="skin" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#E8C8A4"/>
      <stop offset="100%" stop-color="#D4A876"/>
    </radialGradient>
  </defs>
  <rect width="500" height="600" fill="#FAF6F2"/>

  <path d="M 210 430 Q 210 480 215 510 L 285 510 Q 290 480 290 430 Z" fill="#D4A876"/>

  <ellipse cx="250" cy="270" rx="140" ry="175" fill="url(#skin)"/>

  <path d="M 110 260 Q 100 130 250 100 Q 400 130 390 260 Q 390 200 250 180 Q 110 200 110 260 Z" fill="#3B2518"/>

  <ellipse cx="108" cy="280" rx="18" ry="30" fill="#D4A876"/>
  <ellipse cx="392" cy="280" rx="18" ry="30" fill="#D4A876"/>

  <path d="M 165 225 Q 195 210 225 222" stroke="#3B2518" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M 275 222 Q 305 210 335 225" stroke="#3B2518" stroke-width="8" fill="none" stroke-linecap="round"/>

  <ellipse cx="195" cy="255" rx="28" ry="16" fill="#FFFFFF"/>
  <ellipse cx="305" cy="255" rx="28" ry="16" fill="#FFFFFF"/>
  <circle cx="195" cy="255" r="10" fill="#5C4033"/>
  <circle cx="305" cy="255" r="10" fill="#5C4033"/>
  <circle cx="195" cy="255" r="4.5" fill="#1C1210"/>
  <circle cx="305" cy="255" r="4.5" fill="#1C1210"/>
  <path d="M 167 255 Q 195 240 223 255" stroke="#1C1210" stroke-width="2.5" fill="none"/>
  <path d="M 277 255 Q 305 240 333 255" stroke="#1C1210" stroke-width="2.5" fill="none"/>

  <path d="M 250 250 L 240 320 Q 250 335 260 320 Z" fill="none" stroke="#B98A63" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="240" cy="322" rx="6" ry="4" fill="#B98A63" opacity="0.5"/>
  <ellipse cx="260" cy="322" rx="6" ry="4" fill="#B98A63" opacity="0.5"/>

  <path d="M 205 370 Q 250 390 295 370 Q 250 400 205 370 Z" fill="#C4726B"/>
  <path d="M 205 370 Q 250 380 295 370" stroke="#8B4A3D" stroke-width="2" fill="none"/>

  <ellipse cx="170" cy="310" rx="35" ry="25" fill="#C4916C" opacity="0.15"/>
  <ellipse cx="330" cy="310" rx="35" ry="25" fill="#C4916C" opacity="0.15"/>

  <path d="M 190 380 Q 250 430 310 380 Q 280 415 250 420 Q 220 415 190 380 Z" fill="#B98A63" opacity="0.2"/>
</svg>
```

- [ ] **Step 2: Add the `pulse` keyframe to `src/app/globals.css`**

Add after the existing `@keyframes slideUp { ... }` block, at the end of the file:

```css
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds (the SVG is a static public asset, not compiled; the CSS change is additive).

- [ ] **Step 4: Commit**

```bash
git add public/model-face.svg src/app/globals.css
git commit -m "feat: add illustrated Model face asset and pulse animation keyframe"
git push
```

---

### Task 3: ModeSourcePicker + FaceMeshTracker + LandmarkDebugOverlay, wired into Try On tab

**Files:**
- Create: `src/components/tryon/ModeSourcePicker.tsx`
- Create: `src/components/tryon/LandmarkDebugOverlay.tsx`
- Create: `src/components/tryon/FaceMeshTracker.tsx`
- Modify: `src/app/(tabs)/try-on/page.tsx`

**Interfaces:**
- Consumes: `useFaceLandmarks`, `FaceLandmarksState` from `@/lib/facemesh/useFaceLandmarks` (Task 1); `/model-face.svg` and the `pulse` keyframe from `src/app/globals.css` (Task 2).
- Produces: the fully composed Try On tab — this is the last task of Phase 3, no later task depends on these exact interfaces within this plan (Phase 5's Layer panel and Phase 6's Photo/Camera modes will extend this page later).

- [ ] **Step 1: Write `src/components/tryon/ModeSourcePicker.tsx`**

```tsx
const MODES = [
  { id: "model", label: "Model" },
  { id: "photo", label: "Photo" },
  { id: "camera", label: "Camera" },
] as const;

type Props = {
  active: (typeof MODES)[number]["id"];
};

export function ModeSourcePicker({ active }: Props) {
  return (
    <div className="mx-5 flex gap-1 rounded-pill bg-chip p-1">
      {MODES.map((mode) => {
        const isActive = mode.id === active;
        const disabled = mode.id !== "model";
        return (
          <button
            key={mode.id}
            disabled={disabled}
            className={`flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
              isActive ? "bg-ink text-surface" : "text-textFaint"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/tryon/LandmarkDebugOverlay.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

type Props = {
  points: Point[];
  width: number;
  height: number;
};

export function LandmarkDebugOverlay({ points, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#C4916C";
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="landmark-overlay"
      className="pointer-events-none absolute inset-0"
      style={{ animation: "pulse 1.5s ease-in-out infinite" }}
    />
  );
}
```

- [ ] **Step 3: Write `src/components/tryon/FaceMeshTracker.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { LandmarkDebugOverlay } from "./LandmarkDebugOverlay";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 600;

export function FaceMeshTracker() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const state = useFaceLandmarks(imageRef, imageLoaded);

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
          onLoad={() => setImageLoaded(true)}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && (
          <LandmarkDebugOverlay points={state.points} width={IMAGE_WIDTH} height={IMAGE_HEIGHT} />
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

Note: plain `<img>` (not `next/image`) is deliberate here — `next/image` requires known static dimensions handling and adds its own loading/optimization pipeline that complicates getting a plain `HTMLImageElement` ref for MediaPipe's `detect()` call to consume synchronously on load. The `eslint-disable` comment suppresses Next.js's lint rule that otherwise recommends `next/image` for every `<img>`.

- [ ] **Step 4: Replace `src/app/(tabs)/try-on/page.tsx`**

```tsx
import { ModeSourcePicker } from "@/components/tryon/ModeSourcePicker";
import { FaceMeshTracker } from "@/components/tryon/FaceMeshTracker";

export default function TryOnPage() {
  return (
    <main className="px-5 pb-6 pt-6">
      <h1 className="font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active="model" />
      </div>
      <div className="mt-4">
        <FaceMeshTracker />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify build and lint**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 6: Verify with Playwright against the live dev server**

Install Playwright once if not already available in this environment:

```bash
mkdir -p /tmp/pw-verify && cd /tmp/pw-verify && npm init -y >/dev/null 2>&1 && npm install playwright >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1
```

Start the dev server and wait for it:

```bash
cd "C:/Users/sprin/shadestack"
npm run dev > /tmp/tryon-dev.log 2>&1 &
echo $! > /tmp/tryon-dev.pid
timeout 30 bash -c 'until curl -sf http://localhost:3000/try-on >/dev/null; do sleep 1; done'
```

Write and run this verification script:

```bash
cat > /tmp/pw-verify/verify-tryon.mjs <<'EOF'
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto("http://localhost:3000/try-on", { waitUntil: "networkidle" });
await page.waitForSelector("text=Try On");

// wait for detection to finish (canvas overlay appears only on "detected" state)
await page.waitForSelector('[data-testid="landmark-overlay"]', { timeout: 20000 });

const pointCount = await page.evaluate(() => {
  const canvas = document.querySelector('[data-testid="landmark-overlay"]');
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let nonTransparentPixels = 0;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 0) nonTransparentPixels++;
  }
  return nonTransparentPixels;
});

await page.screenshot({ path: "/tmp/pw-verify/tryon-screenshot.png" });

console.log("POINT_PIXELS:", pointCount);
console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors));

await browser.close();
EOF
cd /tmp/pw-verify && node verify-tryon.mjs
```

Expected: `POINT_PIXELS` is a number greater than 0 (proving dots were actually drawn on the canvas, not just that the element exists), `CONSOLE_ERRORS` is `[]`. Open `/tmp/pw-verify/tryon-screenshot.png` and visually confirm small dots are visible over the model face's eyes, nose, mouth, and jawline.

Stop the dev server:

```bash
kill $(cat /tmp/tryon-dev.pid) 2>/dev/null
```

If `POINT_PIXELS` is 0 or the selector times out, the model face isn't being detected in this exact build (even though the design-phase spike confirmed the same SVG works against MediaPipe directly) — check the browser console output captured above for the actual error before assuming the SVG needs changes; a wiring bug (e.g. `detect()` called before the image fully decoded) is more likely than a detection failure, since the identical SVG was already confirmed detectable.

- [ ] **Step 7: Commit**

```bash
git add src/components/tryon/ModeSourcePicker.tsx src/components/tryon/LandmarkDebugOverlay.tsx src/components/tryon/FaceMeshTracker.tsx "src/app/(tabs)/try-on/page.tsx"
git commit -m "feat: wire up Try On tab with Model face detection and mode picker"
git push
```

---

## Self-Review

**Spec coverage:** Design doc decision 1 (CDN hosting) — Task 1's `faceLandmarker.ts` uses `cdn.jsdelivr.net`/`storage.googleapis.com` URLs, no committed binaries. Decision 2 (Model-only interactive, Photo/Camera stubbed) — Task 3's `ModeSourcePicker` disables all but `"model"`. Decision 3 (hand-built SVG, risk verified) — Task 2 ships the exact SVG already confirmed via the design-phase spike to produce 478 detected landmarks; Task 3 Step 6 re-verifies this holds in the actual app build, not just the standalone spike page. Decision 4 (singleton lifecycle) — Task 1's `getFaceLandmarker()` is module-scoped and never torn down; `useFaceLandmarks`'s cleanup only sets a `cancelled` flag, never disposes the landmarker. Decision 5 (IMAGE running mode, single `detect()` call) — Task 1's `createFaceLandmarker()` sets `runningMode: "IMAGE"`; Task 1's hook calls `detect()` once per image-load, not `detectForVideo()`. Decision 6 (Playwright-only testing) — Task 3 Step 6 is the only test in this plan; no vitest files created for anything WASM-dependent.

**Placeholder scan:** none — every step has literal code, the exact SVG markup, or exact commands with expected output.

**Type consistency:** `FaceLandmarksState` is defined once in Task 1 (`useFaceLandmarks.ts`) and consumed with the identical four-variant shape in Task 3's `FaceMeshTracker` (`state.status === "loading" | "detected" | "no-face" | "error"`). `LandmarkDebugOverlay`'s `Point = { x: number; y: number }` matches the `points` field shape produced by `useFaceLandmarks`'s `"detected"` variant exactly (both `{x, y}`, no `z` — MediaPipe's landmarks include `z` but this plan intentionally drops it since the 2D debug overlay never uses depth).
