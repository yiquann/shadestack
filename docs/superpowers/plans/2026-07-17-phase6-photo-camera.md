# Phase 6: Photo Mode + Live Camera Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three Try On face sources real — Model (existing), Photo (upload a selfie), and live Camera (front-cam, mirrored, 30+ fps) — backed by a persistent WebGL renderer that eliminates per-frame GL churn.

**Architecture:** Extract layer-building into a pure helper; replace the stateless `renderComposite` with a persistent per-canvas `createCompositeRenderer` that owns its GL resources; make the source picker interactive and let `TryOnView` switch between Model / Photo / Camera source components. Photo reuses the existing one-shot landmark pipeline; Camera adds a `VIDEO`-mode landmarker plus `getUserMedia` and a `requestVideoFrameCallback` loop that drives the renderer directly.

**Tech Stack:** Next.js (App Router) + React 19 + TypeScript strict, `@mediapipe/tasks-vision` FaceLandmarker, raw WebGL, Vitest.

## Global Constraints

- TypeScript strict mode; **no `any` in the render pipeline**.
- Colors/spacing only via design tokens (Tailwind token classes: `bg`, `ink`, `accent`, `chip`, `textMuted`, `textSecondary`, `textFaint`, `border`, `surface`); never hardcode hex in components.
- WebGL code stays isolated in `src/lib/webgl`; components never touch GL directly except by calling the renderer API.
- FaceLandmarker: `IMAGE`-mode instance is a cached singleton; the `VIDEO`-mode instance is created on Camera mount and `.close()`d on unmount.
- Never upload camera frames or photos anywhere; all processing on-device.
- Preserve the existing render math exactly: `UNPACK_FLIP_Y_WEBGL = false`, premultiplied `TINT_FRAGMENT_SHADER` output, and the multiply/screen `blendFuncSeparate` factors.
- Commit style: conventional commits (`feat:`, `fix:`, `refactor:`, `perf:`).
- Test runner: `npx vitest run <path>`. Lint/types: `npm run lint && npm run typecheck`.

---

### Task 1: Extract `buildGlLayers` pure helper

Pull the `AppliedLayer[] → Layer[]` mapping out of `RenderCanvas` into a pure, tested module so both `RenderCanvas` and (later) `CameraSource` share one implementation.

**Files:**
- Create: `src/lib/webgl/glLayers.ts`
- Create: `src/lib/webgl/glLayers.test.ts`
- Modify: `src/components/tryon/RenderCanvas.tsx`

**Interfaces:**
- Consumes: `Layer`, `hexToRgb01` from `@/lib/webgl/compositor`; `CATEGORY_RENDER` from `@/lib/webgl/categoryZones`; `landmarksToPolygon`, `Point` from `@/lib/facemesh/polygon`; `ZONE_LANDMARKS` from `@/lib/facemesh/zones`; `AppliedLayer` from `@/lib/tryon/session`.
- Produces: `buildGlLayers(layers: AppliedLayer[], points: Point[], width: number, height: number): Layer[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/webgl/glLayers.test.ts
import { describe, expect, it } from "vitest";
import { buildGlLayers } from "./glLayers";
import { CATEGORY_RENDER } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";
import type { Point } from "@/lib/facemesh/polygon";

// 468 dummy normalized landmarks so any zone index resolves.
const POINTS: Point[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));

function layer(overrides: Partial<AppliedLayer>): AppliedLayer {
  return {
    category: "LIPSTICK",
    product: { colorHex: "#B0002E" } as AppliedLayer["product"],
    opacity: 1,
    visible: true,
    ...overrides,
  };
}

describe("buildGlLayers", () => {
  it("skips layers that are not visible", () => {
    const result = buildGlLayers([layer({ visible: false })], POINTS, 100, 100);
    expect(result).toHaveLength(0);
  });

  it("emits one gl layer per configured zone entry", () => {
    const applied = layer({ category: "LIPSTICK" });
    const expected = CATEGORY_RENDER.LIPSTICK.entries.length;
    expect(buildGlLayers([applied], POINTS, 100, 100)).toHaveLength(expected);
  });

  it("scales base opacity by the per-layer opacity", () => {
    const applied = layer({ category: "LIPSTICK", opacity: 0.5 });
    const base = CATEGORY_RENDER.LIPSTICK.baseOpacity;
    const [first] = buildGlLayers([applied], POINTS, 100, 100);
    expect(first.opacity).toBeCloseTo(base * 0.5);
    expect(first.blendMode).toBe(CATEGORY_RENDER.LIPSTICK.blendMode);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/webgl/glLayers.test.ts`
Expected: FAIL — cannot find module `./glLayers`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/webgl/glLayers.ts
import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { hexToRgb01, type Layer } from "./compositor";
import { CATEGORY_RENDER } from "./categoryZones";
import type { AppliedLayer } from "@/lib/tryon/session";

export function buildGlLayers(
  layers: AppliedLayer[],
  points: Point[],
  width: number,
  height: number
): Layer[] {
  return layers
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
}
```

- [ ] **Step 4: Refactor `RenderCanvas` to use it**

Replace the inline `glLayers` construction in `src/components/tryon/RenderCanvas.tsx`. The imports of `landmarksToPolygon`, `ZONE_LANDMARKS`, `CATEGORY_RENDER`, and `hexToRgb01` are no longer needed there. New file body:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Point } from "@/lib/facemesh/polygon";
import { renderComposite } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
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
    renderComposite(canvas, image, buildGlLayers(layers, points, width, height));
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

(Note: this still calls the old `renderComposite`; Task 2 swaps in the persistent renderer.)

- [ ] **Step 5: Run test + typecheck to verify green**

Run: `npx vitest run src/lib/webgl/glLayers.test.ts && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webgl/glLayers.ts src/lib/webgl/glLayers.test.ts src/components/tryon/RenderCanvas.tsx
git commit -m "refactor: extract buildGlLayers pure helper from RenderCanvas"
```

---

### Task 2: Persistent per-canvas WebGL renderer

Replace the stateless `renderComposite` (fresh context + recompiled shaders + new mask canvas every call) with `createCompositeRenderer(canvas)` that compiles once and reuses GL resources. This is the perf pass; it also cleans up the static Model/Photo path.

**Files:**
- Modify: `src/lib/webgl/compositor.ts`
- Modify: `src/lib/webgl/maskTexture.ts`
- Modify: `src/components/tryon/RenderCanvas.tsx`

**Interfaces:**
- Consumes: `BASE_VERTEX_SHADER`, `IMAGE_FRAGMENT_SHADER`, `TINT_FRAGMENT_SHADER`, `createProgram` from `./shaders`; `drawMask` from `./maskTexture`.
- Produces:
  - `createCompositeRenderer(canvas: HTMLCanvasElement): CompositeRenderer`
  - `type CompositeRenderer = { render(source: TexImageSource, layers: Layer[]): void; dispose(): void; }`
  - `drawMask(canvas: HTMLCanvasElement, polygon: Point[], width: number, height: number, featherPx: number): void`
  - `Layer`, `BlendMode`, `hexToRgb01` remain exported (unchanged signatures).
  - `renderComposite` and `buildMaskTexture` are **removed**.

- [ ] **Step 1: Add `drawMask` to `maskTexture.ts`**

Replace the file contents (removes `buildMaskTexture`, adds a canvas-reusing rasterizer):

```ts
// src/lib/webgl/maskTexture.ts
import type { Point } from "@/lib/facemesh/polygon";

/**
 * Rasterize a feathered white polygon mask into `canvas`, reusing the same
 * canvas across calls. Resizing the canvas clears it; when the size is
 * unchanged we clear explicitly so a stale mask never bleeds through.
 */
export function drawMask(
  canvas: HTMLCanvasElement,
  polygon: Point[],
  width: number,
  height: number,
  featherPx: number
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for mask canvas");

  ctx.clearRect(0, 0, width, height);
  ctx.filter = `blur(${featherPx}px)`;
  ctx.beginPath();
  polygon.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();
}
```

- [ ] **Step 2: Rewrite `compositor.ts` as a persistent renderer**

Replace the file contents. Keep `QUAD_VERTICES`, `hexToRgb01`, `Layer`, `BlendMode`, and all blend math verbatim; only resource lifetime changes:

```ts
// src/lib/webgl/compositor.ts
import type { Point } from "@/lib/facemesh/polygon";
import {
  BASE_VERTEX_SHADER,
  IMAGE_FRAGMENT_SHADER,
  TINT_FRAGMENT_SHADER,
  createProgram,
} from "./shaders";
import { drawMask } from "./maskTexture";

export type BlendMode = "multiply" | "screen";

export type Layer = {
  polygon: Point[];
  tintColor: [number, number, number];
  opacity: number;
  blendMode: BlendMode;
  featherPx: number;
};

export type CompositeRenderer = {
  render(source: TexImageSource, layers: Layer[]): void;
  dispose(): void;
};

export function hexToRgb01(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

const QUAD_VERTICES = new Float32Array([
  -1, -1, 0, 1,
  1, -1, 1, 1,
  -1, 1, 0, 0,
  1, 1, 1, 0,
]);

function configureTexture(gl: WebGLRenderingContext, tex: WebGLTexture): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

/**
 * Owns a WebGL context and all its GL objects for the lifetime of `canvas`.
 * Shaders/buffers/textures are created once; `render` re-uploads the source
 * and per-layer masks each call. Suitable for a 30+ fps video loop as well as
 * one-shot static renders.
 */
export function createCompositeRenderer(canvas: HTMLCanvasElement): CompositeRenderer {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL is not supported in this browser");

  // See phase 4 report: FLIP_Y=true rendered the face upside-down and
  // misaligned with the (non-flipped) landmark masks. Keep it false.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const imageProgram = createProgram(gl, BASE_VERTEX_SHADER, IMAGE_FRAGMENT_SHADER);
  const tintProgram = createProgram(gl, BASE_VERTEX_SHADER, TINT_FRAGMENT_SHADER);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  const imageTexture = gl.createTexture();
  if (!imageTexture) throw new Error("Failed to create image texture");
  configureTexture(gl, imageTexture);

  const maskPool: WebGLTexture[] = [];
  const maskScratch = document.createElement("canvas");

  const imageLoc = {
    position: gl.getAttribLocation(imageProgram, "aPosition"),
    texCoord: gl.getAttribLocation(imageProgram, "aTexCoord"),
    uImage: gl.getUniformLocation(imageProgram, "uImage"),
  };
  const tintLoc = {
    position: gl.getAttribLocation(tintProgram, "aPosition"),
    texCoord: gl.getAttribLocation(tintProgram, "aTexCoord"),
    uMask: gl.getUniformLocation(tintProgram, "uMask"),
    uTintColor: gl.getUniformLocation(tintProgram, "uTintColor"),
    uOpacity: gl.getUniformLocation(tintProgram, "uOpacity"),
  };

  function bindQuad(position: number, texCoord: number): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoord);
    gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, 16, 8);
  }

  function maskTextureAt(index: number): WebGLTexture {
    let tex = maskPool[index];
    if (!tex) {
      const created = gl.createTexture();
      if (!created) throw new Error("Failed to create mask texture");
      configureTexture(gl, created);
      tex = created;
      maskPool[index] = tex;
    }
    return tex;
  }

  function render(source: TexImageSource, layers: Layer[]): void {
    const { width, height } = canvas;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Base image pass.
    gl.disable(gl.BLEND);
    gl.useProgram(imageProgram);
    bindQuad(imageLoc.position, imageLoc.texCoord);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(imageLoc.uImage, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Tint passes. Premultiplied source (see TINT_FRAGMENT_SHADER):
    //   multiply -> (DST_COLOR, ONE_MINUS_SRC_ALPHA); screen -> (ONE, ONE_MINUS_SRC_COLOR)
    //   alpha factors (ZERO, ONE) preserve the opaque base alpha.
    gl.enable(gl.BLEND);
    gl.useProgram(tintProgram);
    bindQuad(tintLoc.position, tintLoc.texCoord);
    layers.forEach((layer, i) => {
      if (layer.blendMode === "multiply") {
        gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      } else {
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
      }
      const tex = maskTextureAt(i);
      drawMask(maskScratch, layer.polygon, width, height, layer.featherPx);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskScratch);
      gl.uniform1i(tintLoc.uMask, 0);
      gl.uniform3fv(tintLoc.uTintColor, layer.tintColor);
      gl.uniform1f(tintLoc.uOpacity, layer.opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  }

  function dispose(): void {
    for (const tex of maskPool) gl.deleteTexture(tex);
    gl.deleteTexture(imageTexture);
    gl.deleteBuffer(quadBuffer);
    gl.deleteProgram(imageProgram);
    gl.deleteProgram(tintProgram);
  }

  return { render, dispose };
}
```

- [ ] **Step 3: Point `RenderCanvas` at the persistent renderer**

Hold one renderer per canvas in a ref; create on mount, dispose on unmount, `render` on data changes:

```tsx
// src/components/tryon/RenderCanvas.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Point } from "@/lib/facemesh/polygon";
import { createCompositeRenderer, type CompositeRenderer } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
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
  const rendererRef = useRef<CompositeRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createCompositeRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.render(image, buildGlLayers(layers, points, width, height));
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

- [ ] **Step 4: Typecheck + confirm no remaining `renderComposite`/`buildMaskTexture` references**

Run: `npm run typecheck`
Expected: PASS. Then grep to confirm the removed exports have no callers:

Run: `git grep -n "renderComposite\|buildMaskTexture" -- src`
Expected: no matches.

- [ ] **Step 5: Verify Model rendering is unchanged**

Run: `npm run dev`, open the Try On tab in a browser. Expected: the Model face still composites the active layers correctly (add a lipstick from Add Products; the lips tint). No console errors. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webgl/compositor.ts src/lib/webgl/maskTexture.ts src/components/tryon/RenderCanvas.tsx
git commit -m "perf: replace stateless renderComposite with persistent per-canvas renderer"
```

---

### Task 3: Interactive source picker + `TryOnView` mode switching

Make `ModeSourcePicker` a controlled component and let `TryOnView` own the active mode, rendering Model today and stub Photo/Camera panels (filled in Tasks 4 and 6).

**Files:**
- Modify: `src/components/tryon/ModeSourcePicker.tsx`
- Modify: `src/components/tryon/TryOnView.tsx`
- Create: `src/components/tryon/PhotoSource.tsx` (temporary stub)
- Create: `src/components/tryon/CameraSource.tsx` (temporary stub)

**Interfaces:**
- Produces: `type SourceMode = "model" | "photo" | "camera"` (exported from `ModeSourcePicker.tsx`); `ModeSourcePicker` props `{ active: SourceMode; onChange: (mode: SourceMode) => void }`.
- Consumes: `useTryOnSession` (`{ layers }`), `FaceMeshTracker`, `PhotoSource`, `CameraSource`.

- [ ] **Step 1: Make `ModeSourcePicker` controlled**

Replace the file. All three segments are enabled; the active one uses `bg-ink text-surface`, inactive use the existing token styles:

```tsx
// src/components/tryon/ModeSourcePicker.tsx
export type SourceMode = "model" | "photo" | "camera";

const MODES: { id: SourceMode; label: string }[] = [
  { id: "model", label: "Model" },
  { id: "photo", label: "Photo" },
  { id: "camera", label: "Camera" },
];

type Props = {
  active: SourceMode;
  onChange: (mode: SourceMode) => void;
};

const SEGMENT_BASE =
  "flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function ModeSourcePicker({ active, onChange }: Props) {
  return (
    <div className="mx-5 flex gap-1 rounded-pill bg-chip p-1">
      {MODES.map((mode) => {
        const isActive = mode.id === active;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(mode.id)}
            className={`${SEGMENT_BASE} ${
              isActive
                ? "bg-ink text-surface"
                : "text-textSecondary hover:bg-chip-hover hover:text-ink"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add temporary stubs for Photo and Camera**

```tsx
// src/components/tryon/PhotoSource.tsx
"use client";

import type { AppliedLayer } from "@/lib/tryon/session";

export function PhotoSource(_props: { layers: AppliedLayer[] }) {
  return (
    <p className="mx-auto max-w-xs text-center text-xs text-textMuted">
      Photo mode coming up.
    </p>
  );
}
```

```tsx
// src/components/tryon/CameraSource.tsx
"use client";

import type { AppliedLayer } from "@/lib/tryon/session";

export function CameraSource(_props: { layers: AppliedLayer[] }) {
  return (
    <p className="mx-auto max-w-xs text-center text-xs text-textMuted">
      Camera mode coming up.
    </p>
  );
}
```

- [ ] **Step 3: Wire mode state into `TryOnView`**

```tsx
// src/components/tryon/TryOnView.tsx
"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker, type SourceMode } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { PhotoSource } from "./PhotoSource";
import { CameraSource } from "./CameraSource";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { AddProductsSection } from "./AddProductsSection";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { layers } = useTryOnSession();
  const [mode, setMode] = useState<SourceMode>("model");

  return (
    <main className="pb-6">
      <h1 className="px-5 pt-6 font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active={mode} onChange={setMode} />
      </div>
      <div className="mt-4 px-5">
        {mode === "model" && <FaceMeshTracker layers={layers} />}
        {mode === "photo" && <PhotoSource layers={layers} />}
        {mode === "camera" && <CameraSource layers={layers} />}
      </div>
      <LayerPanel />
      <AddProductsSection products={products} />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + verify switching**

Run: `npm run typecheck && npm run dev`. In the browser, tap Model / Photo / Camera; the active segment darkens and the panel below swaps. Stop the server.
Expected: PASS; all three segments clickable.

- [ ] **Step 5: Commit**

```bash
git add src/components/tryon/ModeSourcePicker.tsx src/components/tryon/TryOnView.tsx src/components/tryon/PhotoSource.tsx src/components/tryon/CameraSource.tsx
git commit -m "feat: make source picker interactive and switch try-on source by mode"
```

---

### Task 4: Photo mode

Fill in `PhotoSource`: upload a selfie, run the existing one-shot landmark pipeline on it, composite via `RenderCanvas`. Reuses `useFaceLandmarks` unchanged.

**Files:**
- Modify: `src/components/tryon/PhotoSource.tsx`

**Interfaces:**
- Consumes: `useFaceLandmarks(imageRef, imageLoaded)` from `@/lib/facemesh/useFaceLandmarks`; `RenderCanvas` from `./RenderCanvas`; `AppliedLayer` from `@/lib/tryon/session`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Implement `PhotoSource`**

The uploaded image is measured with `naturalWidth/Height` and rendered at a capped display size so the canvas matches the `<img>` box. Object URLs are revoked on replace and unmount.

```tsx
// src/components/tryon/PhotoSource.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas } from "./RenderCanvas";
import type { AppliedLayer } from "@/lib/tryon/session";

const MAX_WIDTH = 500;
const MAX_HEIGHT = 600;

type Props = {
  layers: AppliedLayer[];
};

export function PhotoSource({ layers }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ width: MAX_WIDTH, height: MAX_HEIGHT });
  const state = useFaceLandmarks(imageRef, imageLoaded);

  // Revoke the object URL whenever it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoaded(false);
    setImageEl(null);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const scale = Math.min(MAX_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight, 1);
    setSize({
      width: Math.round(img.naturalWidth * scale),
      height: Math.round(img.naturalHeight * scale),
    });
    setImageLoaded(true);
    setImageEl(img);
  }

  if (!url) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-10 text-center">
        <p className="max-w-xs text-xs text-textMuted">
          Use a well-lit selfie with no makeup for the most accurate try-on results.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-pill bg-accent px-5 py-2 text-xs font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover"
        >
          Upload a photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card"
        style={{ width: size.width, height: size.height, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={url}
          alt="Uploaded selfie"
          onLoad={onImageLoad}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && imageEl && (
          <RenderCanvas
            image={imageEl}
            points={state.points}
            width={size.width}
            height={size.height}
            layers={layers}
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
        >
          Choose another photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
      </div>
      {state.status === "loading" && (
        <p className="mt-2 text-center text-xs text-textMuted">Analyzing photo…</p>
      )}
      {state.status === "no-face" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          No face detected — try a clearer, front-facing selfie.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-center text-xs text-textMuted">
          Could not analyze photo: {state.message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify Photo mode end-to-end**

Run: `npm run dev`. Try On → Photo → Upload a photo. Pick a well-lit face photo. Expected: empty-state prompt shows first; after upload, landmarks resolve and active layers composite onto the face; "Choose another photo" swaps the image; a non-face image shows "No face detected". Confirm no console warning about leaked object URLs. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/tryon/PhotoSource.tsx
git commit -m "feat: add photo mode with selfie upload and one-shot compositing"
```

---

### Task 5: VIDEO landmarker factory + camera pure helpers

Add the `VIDEO`-mode landmarker factory and two small pure helpers the camera loop needs: facing-mode flip and the degrade-throttle decision. TDD the pure helpers.

**Files:**
- Modify: `src/lib/facemesh/faceLandmarker.ts`
- Create: `src/lib/facemesh/cameraHelpers.ts`
- Create: `src/lib/facemesh/cameraHelpers.test.ts`

**Interfaces:**
- Produces:
  - `createVideoFaceLandmarker(): Promise<FaceLandmarker>` (runningMode `"VIDEO"`).
  - `type FacingMode = "user" | "environment"`; `nextFacingMode(current: FacingMode): FacingMode`.
  - `detectionInterval(avgFrameMs: number): number` — frames between detections (1 = every frame). Never returns 0.
- Consumes: `FaceLandmarker`, `FilesetResolver` from `@mediapipe/tasks-vision`.

- [ ] **Step 1: Write failing tests for the pure helpers**

```ts
// src/lib/facemesh/cameraHelpers.test.ts
import { describe, expect, it } from "vitest";
import { nextFacingMode, detectionInterval } from "./cameraHelpers";

describe("nextFacingMode", () => {
  it("toggles user -> environment", () => {
    expect(nextFacingMode("user")).toBe("environment");
  });
  it("toggles environment -> user", () => {
    expect(nextFacingMode("environment")).toBe("user");
  });
});

describe("detectionInterval", () => {
  it("detects every frame when comfortably at/above 30fps", () => {
    expect(detectionInterval(1000 / 60)).toBe(1);
    expect(detectionInterval(1000 / 30)).toBe(1);
  });
  it("halves detection cadence when between 24 and 30fps", () => {
    expect(detectionInterval(1000 / 27)).toBe(2);
  });
  it("stays at every-other-frame under 24fps (never drops resolution here)", () => {
    expect(detectionInterval(1000 / 15)).toBe(2);
  });
  it("never returns zero for absurd inputs", () => {
    expect(detectionInterval(0)).toBe(1);
    expect(detectionInterval(Number.NaN)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/facemesh/cameraHelpers.test.ts`
Expected: FAIL — cannot find module `./cameraHelpers`.

- [ ] **Step 3: Implement the pure helpers**

```ts
// src/lib/facemesh/cameraHelpers.ts
export type FacingMode = "user" | "environment";

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === "user" ? "environment" : "user";
}

const FPS_30_MS = 1000 / 30;
const FPS_24_MS = 1000 / 24;

/**
 * How many frames to draw between landmark detections. At/above 30fps we detect
 * every frame; once the rolling frame time slips past the 30fps budget we detect
 * every other frame (keep drawing the last composite) to protect frame rate —
 * before any resolution drop, per the 30fps target. Guards against 0/NaN.
 */
export function detectionInterval(avgFrameMs: number): number {
  if (!Number.isFinite(avgFrameMs) || avgFrameMs <= FPS_30_MS) return 1;
  // avgFrameMs > FPS_30_MS (i.e. below 30fps): halve detection cadence.
  void FPS_24_MS;
  return 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/facemesh/cameraHelpers.test.ts`
Expected: PASS (all 8 assertions).

- [ ] **Step 5: Add the VIDEO landmarker factory**

Factor the shared config so the two factories don't drift. Replace `faceLandmarker.ts`:

```ts
// src/lib/facemesh/faceLandmarker.ts
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function create(runningMode: "IMAGE" | "VIDEO"): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode,
    numFaces: 1,
  });
}

/** Cached IMAGE-mode singleton for Model and Photo (one-shot detect). */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create("IMAGE");
  }
  return landmarkerPromise;
}

/**
 * A fresh VIDEO-mode landmarker for the live camera loop. Not cached: the
 * caller owns it and must call `.close()` when the camera view unmounts.
 */
export function createVideoFaceLandmarker(): Promise<FaceLandmarker> {
  return create("VIDEO");
}
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npm run typecheck && npx vitest run`
Expected: PASS across the suite.

- [ ] **Step 7: Commit**

```bash
git add src/lib/facemesh/faceLandmarker.ts src/lib/facemesh/cameraHelpers.ts src/lib/facemesh/cameraHelpers.test.ts
git commit -m "feat: add VIDEO-mode landmarker factory and camera loop helpers"
```

---

### Task 6: Live Camera mode

Fill in `CameraSource`: request the front camera, run the per-frame VIDEO detection loop, drive the persistent renderer directly (bypassing React state for perf), mirror the preview, and expose Flip. Add a dev-only FPS readout to validate the 30fps target.

**Files:**
- Create: `src/lib/facemesh/useCameraStream.ts`
- Modify: `src/components/tryon/CameraSource.tsx`

**Interfaces:**
- Consumes: `createVideoFaceLandmarker` from `@/lib/facemesh/faceLandmarker`; `nextFacingMode`, `detectionInterval`, `FacingMode` from `@/lib/facemesh/cameraHelpers`; `createCompositeRenderer` from `@/lib/webgl/compositor`; `buildGlLayers` from `@/lib/webgl/glLayers`; `AppliedLayer` from `@/lib/tryon/session`; `FaceLandmarker` from `@mediapipe/tasks-vision`.
- Produces:
  - `useCameraStream(facingMode: FacingMode): { stream: MediaStream | null; status: "idle" | "ready" | "denied" | "error"; message?: string }`.

- [ ] **Step 1: Implement `useCameraStream`**

```ts
// src/lib/facemesh/useCameraStream.ts
"use client";

import { useEffect, useState } from "react";
import type { FacingMode } from "./cameraHelpers";

type CameraState = {
  stream: MediaStream | null;
  status: "idle" | "ready" | "denied" | "error";
  message?: string;
};

/**
 * Requests a camera stream for the given facing mode and stops all its tracks
 * on change/unmount so the camera indicator never lingers.
 */
export function useCameraStream(facingMode: FacingMode): CameraState {
  const [state, setState] = useState<CameraState>({ stream: null, status: "idle" });

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        setState({ stream, status: "ready" });
      } catch (e) {
        if (!active) return;
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setState({
          stream: null,
          status: denied ? "denied" : "error",
          message: e instanceof Error ? e.message : "Camera unavailable",
        });
      }
    }

    start();
    return () => {
      active = false;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return state;
}
```

- [ ] **Step 2: Implement `CameraSource`**

Drives its own canvas + renderer + rVFC loop. The loop reads a monotonic timestamp, detects on the throttled cadence, and re-renders every frame with the latest points and current layers (held in a ref so layer edits don't restart the loop).

```tsx
// src/components/tryon/CameraSource.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { createVideoFaceLandmarker } from "@/lib/facemesh/faceLandmarker";
import {
  nextFacingMode,
  detectionInterval,
  type FacingMode,
} from "@/lib/facemesh/cameraHelpers";
import { useCameraStream } from "@/lib/facemesh/useCameraStream";
import { createCompositeRenderer } from "@/lib/webgl/compositor";
import { buildGlLayers } from "@/lib/webgl/glLayers";
import type { Point } from "@/lib/facemesh/polygon";
import type { AppliedLayer } from "@/lib/tryon/session";

const WIDTH = 500;
const HEIGHT = 600;
const SHOW_FPS = process.env.NODE_ENV !== "production";

type Props = {
  layers: AppliedLayer[];
};

export function CameraSource({ layers }: Props) {
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const { stream, status, message } = useCameraStream(facingMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(layers);
  const [fps, setFps] = useState(0);

  // Keep the loop reading current layers without restarting on each edit.
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // Attach the stream to the <video>.
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream]);

  // The render/detection loop: lives while a stream is ready.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !video || !canvas) return;

    let cancelled = false;
    let landmarker: FaceLandmarker | null = null;
    let rafId = 0;
    let vfcId = 0;
    let frameCount = 0;
    let lastPoints: Point[] | null = null;
    let avgFrameMs = 1000 / 60;
    let lastTs = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;

    const renderer = createCompositeRenderer(canvas);

    const useVfc = typeof (video as HTMLVideoElement & {
      requestVideoFrameCallback?: unknown;
    }).requestVideoFrameCallback === "function";

    function schedule(cb: () => void) {
      if (useVfc) {
        vfcId = (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        }).requestVideoFrameCallback(cb);
      } else {
        rafId = requestAnimationFrame(cb);
      }
    }

    function tick() {
      if (cancelled || !video || !canvas || !landmarker) return;
      const now = performance.now();
      const frameMs = now - lastTs;
      lastTs = now;
      avgFrameMs = avgFrameMs * 0.9 + frameMs * 0.1;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const interval = detectionInterval(avgFrameMs);
        if (frameCount % interval === 0) {
          const result = landmarker.detectForVideo(video, now);
          const face = result.faceLandmarks[0];
          lastPoints = face && face.length > 0 ? face.map((p) => ({ x: p.x, y: p.y })) : null;
        }
        const glLayers = lastPoints
          ? buildGlLayers(layersRef.current, lastPoints, canvas.width, canvas.height)
          : [];
        renderer.render(video, glLayers);
      }

      frameCount += 1;
      fpsAccum += frameMs;
      fpsFrames += 1;
      if (SHOW_FPS && fpsAccum >= 500) {
        setFps(Math.round(1000 / (fpsAccum / fpsFrames)));
        fpsAccum = 0;
        fpsFrames = 0;
      }
      schedule(tick);
    }

    createVideoFaceLandmarker().then((lm) => {
      if (cancelled) {
        lm.close();
        return;
      }
      landmarker = lm;
      schedule(tick);
    });

    return () => {
      cancelled = true;
      if (useVfc && "cancelVideoFrameCallback" in video) {
        (video as HTMLVideoElement & {
          cancelVideoFrameCallback: (id: number) => void;
        }).cancelVideoFrameCallback(vfcId);
      } else {
        cancelAnimationFrame(rafId);
      }
      renderer.dispose();
      landmarker?.close();
    };
  }, [status]);

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-card bg-ink"
        style={{ width: WIDTH, height: HEIGHT, maxWidth: "100%" }}
      >
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
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />
        {SHOW_FPS && status === "ready" && (
          <span className="absolute left-2 top-2 rounded-pill bg-ink/60 px-2 py-1 text-[10px] font-semibold text-surface">
            {fps} fps
          </span>
        )}
      </div>

      {status === "ready" && (
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setFacingMode(nextFacingMode)}
            className="rounded-pill bg-chip px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
          >
            Flip camera
          </button>
        </div>
      )}
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
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS, no `any` in the render pipeline (the `requestVideoFrameCallback` casts are typed inline, not `any`).

- [ ] **Step 4: Verify Camera mode end-to-end**

Run: `npm run dev`, open Try On → Camera in a browser and grant camera permission. Expected:
- Mirrored live feed fills the frame; active layers composite in real time on your face.
- The dev FPS badge reads **30+** with a couple of layers applied.
- "Flip camera" switches cameras (on multi-camera devices); on a single-camera laptop it re-requests without error.
- Denying permission shows the "Camera access is needed" message.
- Switching to Model/Photo and back stops/restarts the camera cleanly (camera light turns off when you leave). Stop the server.

- [ ] **Step 5: Verify the degrade path**

Apply several layers and, if the FPS badge dips below 30, confirm it stabilizes (detection every other frame) rather than stuttering, and the resolution/frame size is unchanged. If your hardware never dips below 30, note that the throttle is exercised by the Task 5 unit tests and move on.

- [ ] **Step 6: Commit**

```bash
git add src/lib/facemesh/useCameraStream.ts src/components/tryon/CameraSource.tsx
git commit -m "feat: add live camera mode with per-frame video tracking at 30fps"
```

---

## Self-Review Notes

- **Spec coverage:** mode state/switching (Task 3) ✓; two-landmarker lifecycle — IMAGE singleton unchanged, VIDEO factory created/closed on Camera mount/unmount (Tasks 5–6) ✓; Photo upload + one-shot reuse + prompt copy + URL revocation + on-device (Task 4) ✓; Camera getUserMedia/facingMode/flip/cleanup, mirroring, rVFC loop, degrade throttle (Tasks 5–6) ✓; persistent renderer replacing renderComposite, math preserved, used by all modes (Tasks 1–2, 6) ✓; unit tests for flip + throttle, manual verification for WebGL/camera + FPS readout (Tasks 5–6) ✓. Split-view/shade/saved correctly untouched.
- **Type consistency:** `SourceMode`, `FacingMode`, `CompositeRenderer`, `buildGlLayers`, `detectionInterval`, `nextFacingMode`, `createVideoFaceLandmarker`, `useCameraStream` names/signatures match across producing and consuming tasks.
- **Placeholder scan:** no TBD/"handle edge cases"; every code step shows full code.
- **Note on `AppliedLayer` shape:** the Task 1 test constructs `product` via a cast to keep the fixture minimal; if `AppliedLayer`/`session.ts` field names differ from `{ category, product, opacity, visible }`, adjust the fixture and `buildGlLayers` field access to match the real type before implementing.
