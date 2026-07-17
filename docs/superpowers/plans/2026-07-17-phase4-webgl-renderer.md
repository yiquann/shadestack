# Phase 4: WebGL Layer Renderer (6 Zones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WebGL compositing pipeline that tints landmark-derived facial zones with per-category blend modes (multiply/screen) and feathered masks, proven end-to-end with lips first, then all remaining zones, against hardcoded demo layers on the Phase 3 Model face.

**Architecture:** `src/lib/facemesh/zones.ts` maps zone names to MediaPipe landmark indices (verified against a real detection pass during design). `src/lib/webgl/` is a self-contained rendering module: mask textures are built via 2D-canvas polygon fill + CSS blur (feathering) then uploaded to WebGL; a single "tint" shader program renders each layer as `tintColor * maskAlpha * opacity`, with the actual multiply/screen compositing done by WebGL's fixed-function blend state, not shader math. `RenderCanvas.tsx` orchestrates: draw the base face image (opaque), then each demo layer in bottom-to-top order.

**Tech Stack:** Raw WebGL 1 (`canvas.getContext("webgl")`, no Three.js/other libraries — CLAUDE.md specifies "custom fragment shaders"), Vitest for pure landmark/polygon math, Playwright for visual/runtime verification (WebGL can't run in vitest).

## Global Constraints

- TypeScript strict mode; no `any` in the render pipeline (CLAUDE.md Conventions — this phase IS the render pipeline, so this is a hard constraint here).
- WebGL code isolated in `lib/webgl`; components never touch GL directly (CLAUDE.md Conventions) — `RenderCanvas.tsx` calls into `lib/webgl`'s exported functions only, never calls `gl.*` itself.
- Per-category baseline blend mode/opacity, copied verbatim from CLAUDE.md's Rendering Fidelity Targets table:
  - Foundation: full-face, multiply, ~0.15–0.20 opacity
  - Setting powder: full-face, multiply, ~0.06 opacity
  - Blush: cheek zones, multiply, ~0.32 opacity, heavy feather
  - Bronzer: temples + jawline, multiply, ~0.14–0.22, heaviest blur
  - Highlighter: cheekbones + nose bridge, screen, ~0.20–0.30
  - Eyeshadow: lid zones, multiply, ~0.32, tight feather
  - Lipstick: lip zone, multiply, ~0.55
- Colors/spacing only via design tokens in UI chrome around the canvas (the canvas's own rendered pixel colors are per-product `colorHex` data, not design tokens — same distinction already established in Phase 2).
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`).
- Zone landmark indices for lips, both eyes, and the face oval were independently verified during design (a real MediaPipe `detect()` pass against the Model face, screenshotted, confirmed each polygon traces the correct facial feature) — use the exact index arrays given in Task 1, do not substitute different values.

---

### Task 1: Zone landmark maps + polygon math

**Files:**
- Create: `src/lib/facemesh/zones.ts`
- Create: `src/lib/facemesh/polygon.ts`
- Create: `src/lib/facemesh/polygon.test.ts`

**Interfaces:**
- Produces: `ZONE_LANDMARKS: Record<ZoneName, readonly number[]>` where
  `ZoneName = "lips" | "leftEye" | "rightEye" | "faceOval" | "leftCheek" | "rightCheek" | "forehead" | "jawline"`.
- Produces: `type Point = { x: number; y: number }` and
  `landmarksToPolygon(landmarks: Point[], indices: readonly number[], width: number, height: number): Point[]`.
  Task 3's `RenderCanvas` and Task 2's mask builder both consume this exact function and type.

- [ ] **Step 1: Write `src/lib/facemesh/zones.ts`**

```ts
export const ZONE_LANDMARKS = {
  lips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  leftCheek: [50, 101, 118, 187, 205, 36],
  rightCheek: [280, 330, 347, 411, 425, 266],
  forehead: [109, 10, 338, 296, 336, 285, 8, 55, 107],
  jawline: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361],
} as const;

export type ZoneName = keyof typeof ZONE_LANDMARKS;
```

Note: `lips`, `leftEye`, `rightEye`, and `faceOval` are exact, independently-verified index
sets (see Global Constraints). `leftCheek`, `rightCheek`, `forehead`, and `jawline` are
reasonable landmark-neighborhood approximations — there is no single canonical "cheek
zone" in MediaPipe's own connection tables (this is true industry-wide; AR makeup
products define these regions themselves too). Task 5's Playwright screenshot step is
where these four get visually checked and adjusted if a mask looks misplaced.

- [ ] **Step 2: Write `src/lib/facemesh/polygon.ts`**

```ts
export type Point = { x: number; y: number };

export function landmarksToPolygon(
  landmarks: Point[],
  indices: readonly number[],
  width: number,
  height: number
): Point[] {
  return indices.map((i) => {
    const p = landmarks[i];
    return { x: p.x * width, y: p.y * height };
  });
}
```

- [ ] **Step 3: Write the failing test — `src/lib/facemesh/polygon.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { landmarksToPolygon } from "./polygon";

describe("landmarksToPolygon", () => {
  it("maps normalized landmark coordinates to pixel space", () => {
    const landmarks = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    const result = landmarksToPolygon(landmarks, [0, 1, 2], 500, 600);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 250, y: 300 },
      { x: 500, y: 600 },
    ]);
  });

  it("selects only the requested indices, in the given order", () => {
    const landmarks = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
    ];
    const result = landmarksToPolygon(landmarks, [2, 0], 100, 100);
    expect(result).toEqual([
      { x: 30, y: 30 },
      { x: 10, y: 10 },
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run src/lib/facemesh/polygon.test.ts
```

Expected: FAIL — `Cannot find module './polygon'` (the test imports before Step 2's file
exists if run out of order; if Step 2 was already done, skip to Step 5 — the TDD ordering
here is nominal since `polygon.ts`'s implementation is trivial and given verbatim).

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/facemesh/polygon.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/facemesh/zones.ts src/lib/facemesh/polygon.ts src/lib/facemesh/polygon.test.ts
git commit -m "feat: add zone landmark maps and polygon coordinate math"
git push
```

---

### Task 2: WebGL shaders + mask texture builder

**Files:**
- Create: `src/lib/webgl/shaders.ts`
- Create: `src/lib/webgl/maskTexture.ts`

**Interfaces:**
- Consumes: `Point` from `@/lib/facemesh/polygon` (Task 1).
- Produces: `BASE_VERTEX_SHADER`, `IMAGE_FRAGMENT_SHADER`, `TINT_FRAGMENT_SHADER` (GLSL
  source strings), `compileShader(gl, type, source): WebGLShader`,
  `createProgram(gl, vertexSource, fragmentSource): WebGLProgram`.
- Produces: `buildMaskTexture(gl: WebGLRenderingContext, polygon: Point[], width: number, height: number, featherPx: number): WebGLTexture`.
  Task 3's compositor consumes all of the above exactly.

- [ ] **Step 1: Write `src/lib/webgl/shaders.ts`**

```ts
export const BASE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord = aTexCoord;
}
`;

export const IMAGE_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uImage;
void main() {
  gl_FragColor = texture2D(uImage, vTexCoord);
}
`;

export const TINT_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uMask;
uniform vec3 uTintColor;
uniform float uOpacity;
void main() {
  float maskAlpha = texture2D(uMask, vTexCoord).a;
  gl_FragColor = vec4(uTintColor, maskAlpha * uOpacity);
}
`;

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}
```

- [ ] **Step 2: Write `src/lib/webgl/maskTexture.ts`**

```ts
import type { Point } from "@/lib/facemesh/polygon";

export function buildMaskTexture(
  gl: WebGLRenderingContext,
  polygon: Point[],
  width: number,
  height: number,
  featherPx: number
): WebGLTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for mask canvas");

  ctx.filter = `blur(${featherPx}px)`;
  ctx.beginPath();
  polygon.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();

  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create mask texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. Nothing consumes these files yet (Task 3 wires them up).

- [ ] **Step 4: Commit**

```bash
git add src/lib/webgl/shaders.ts src/lib/webgl/maskTexture.ts
git commit -m "feat: add WebGL shaders and mask texture builder"
git push
```

---

### Task 3: Compositor + RenderCanvas wired to Try On tab (lips zone only)

**Files:**
- Create: `src/lib/webgl/compositor.ts`
- Create: `src/components/tryon/RenderCanvas.tsx`
- Modify: `src/components/tryon/FaceMeshTracker.tsx`

**Interfaces:**
- Consumes: `BASE_VERTEX_SHADER`, `IMAGE_FRAGMENT_SHADER`, `TINT_FRAGMENT_SHADER`,
  `createProgram`, `buildMaskTexture` (Task 2); `landmarksToPolygon`, `ZONE_LANDMARKS`
  (Task 1); `FaceLandmarksState` (Phase 3).
- Produces: `Layer` type, `renderComposite(canvas: HTMLCanvasElement, image: HTMLImageElement, layers: Layer[]): void`,
  `hexToRgb01(hex: string): [number, number, number]`. `RenderCanvas({ image, points }: { image: HTMLImageElement; points: {x:number;y:number}[] })`
  — this is the exact prop shape Task 5 extends with more layers, not a new component.

- [ ] **Step 1: Write `src/lib/webgl/compositor.ts`**

```ts
import type { Point } from "@/lib/facemesh/polygon";
import { BASE_VERTEX_SHADER, IMAGE_FRAGMENT_SHADER, TINT_FRAGMENT_SHADER, createProgram } from "./shaders";
import { buildMaskTexture } from "./maskTexture";

export type BlendMode = "multiply" | "screen";

export type Layer = {
  polygon: Point[];
  tintColor: [number, number, number];
  opacity: number;
  blendMode: BlendMode;
  featherPx: number;
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

export function renderComposite(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  layers: Layer[]
): void {
  const gl = canvas.getContext("webgl");
  if (!gl) throw new Error("WebGL is not supported in this browser");

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const imageProgram = createProgram(gl, BASE_VERTEX_SHADER, IMAGE_FRAGMENT_SHADER);
  const tintProgram = createProgram(gl, BASE_VERTEX_SHADER, TINT_FRAGMENT_SHADER);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  function bindQuadAttributes(program: WebGLProgram) {
    const positionLoc = gl.getAttribLocation(program, "aPosition");
    const texCoordLoc = gl.getAttribLocation(program, "aTexCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.disable(gl.BLEND);
  gl.useProgram(imageProgram);
  bindQuadAttributes(imageProgram);
  const imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(gl.getUniformLocation(imageProgram, "uImage"), 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.enable(gl.BLEND);
  gl.useProgram(tintProgram);
  bindQuadAttributes(tintProgram);
  for (const layer of layers) {
    if (layer.blendMode === "multiply") {
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    } else {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    }
    const maskTexture = buildMaskTexture(gl, layer.polygon, canvas.width, canvas.height, layer.featherPx);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(gl.getUniformLocation(tintProgram, "uMask"), 0);
    gl.uniform3fv(gl.getUniformLocation(tintProgram, "uTintColor"), layer.tintColor);
    gl.uniform1f(gl.getUniformLocation(tintProgram, "uOpacity"), layer.opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
```

Note on `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`: this is the standard fix for
WebGL's texture-coordinate-vs-image-row-order mismatch when uploading an
`HTMLImageElement`/canvas directly. **Troubleshooting**: if Step 4's verification shows
the rendered face upside-down or mirrored, this is the first thing to check — try
removing this line or setting it to `false` and re-verify, since the exact interaction
between this flag and the quad's texture coordinates can't be fully confirmed without
running it in a real browser.

- [ ] **Step 2: Write `src/components/tryon/RenderCanvas.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { landmarksToPolygon, type Point } from "@/lib/facemesh/polygon";
import { ZONE_LANDMARKS } from "@/lib/facemesh/zones";
import { renderComposite, hexToRgb01, type Layer } from "@/lib/webgl/compositor";

type Props = {
  image: HTMLImageElement;
  points: Point[];
  width: number;
  height: number;
};

export function RenderCanvas({ image, points, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const lipsPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.lips, width, height);
    const layers: Layer[] = [
      {
        polygon: lipsPolygon,
        tintColor: hexToRgb01("#B23A3A"),
        opacity: 0.55,
        blendMode: "multiply",
        featherPx: 2,
      },
    ];

    renderComposite(canvas, image, layers);
  }, [image, points, width, height]);

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

- [ ] **Step 3: Wire `RenderCanvas` into `src/components/tryon/FaceMeshTracker.tsx`**

Replace the `LandmarkDebugOverlay` import and its usage with `RenderCanvas`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceLandmarks } from "@/lib/facemesh/useFaceLandmarks";
import { RenderCanvas } from "./RenderCanvas";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 600;

export function FaceMeshTracker() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const state = useFaceLandmarks(imageRef, imageLoaded);

  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setImageLoaded(true);
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
          onLoad={() => setImageLoaded(true)}
          className="h-full w-full object-cover"
        />
        {state.status === "detected" && imageRef.current && (
          <RenderCanvas
            image={imageRef.current}
            points={state.points}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
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

Note: `LandmarkDebugOverlay.tsx` (from Phase 3) is no longer imported by this file, but
leave the file itself in place — deleting it is out of scope for this task (YAGNI: don't
remove working code as a side effect of an unrelated task; if it becomes truly dead code
after this phase, that's a follow-up).

- [ ] **Step 4: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 5: Verify with Playwright against the live dev server**

```bash
cd "C:/Users/sprin/shadestack"
npm run dev > /tmp/webgl-dev.log 2>&1 &
echo $! > /tmp/webgl-dev.pid
timeout 30 bash -c 'until curl -sf http://localhost:3000/try-on >/dev/null; do sleep 1; done'
```

Use the Playwright installation from Phase 3's verification (in `/tmp/pw-verify` if
still present, otherwise reinstall: `mkdir -p /tmp/pw-verify && cd /tmp/pw-verify && npm init -y >/dev/null 2>&1 && npm install playwright >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1`).

```bash
cat > /tmp/pw-verify/verify-webgl.mjs <<'EOF'
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto("http://localhost:3000/try-on", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="render-canvas"]', { timeout: 20000 });
await page.waitForTimeout(500);

const nonTransparentPixels = await page.evaluate(() => {
  const canvas = document.querySelector('[data-testid="render-canvas"]');
  const gl = canvas.getContext("webgl");
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let count = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) count++;
  }
  return count;
});

await page.screenshot({ path: "/tmp/pw-verify/webgl-screenshot.png" });

console.log("NON_TRANSPARENT_PIXELS:", nonTransparentPixels);
console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors));

await browser.close();
EOF
cd /tmp/pw-verify && node verify-webgl.mjs
```

Expected: `NON_TRANSPARENT_PIXELS` is a large number (the whole face image is opaque, so
this should be most of the 500×600 canvas — hundreds of thousands, not just the lips
area, since the base image draw fills the whole canvas). `CONSOLE_ERRORS` should contain
only the same benign MediaPipe XNNPACK line already known from Phase 3, nothing else.

Open `/tmp/pw-verify/webgl-screenshot.png` and visually confirm: the face renders
right-side-up (not upside-down or mirrored — see Step 1's troubleshooting note if it
is), and the lips are visibly tinted a red/berry color darker than the base illustration,
not the whole face tinted red and not the tint in the wrong location.

Stop the dev server:

```bash
kill $(cat /tmp/webgl-dev.pid) 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/webgl/compositor.ts src/components/tryon/RenderCanvas.tsx src/components/tryon/FaceMeshTracker.tsx
git commit -m "feat: add WebGL compositor and wire up lips zone end-to-end"
git push
```

---

### Task 4: Remaining five zones as demo layers

**Files:**
- Modify: `src/components/tryon/RenderCanvas.tsx`

**Interfaces:**
- Consumes: `ZONE_LANDMARKS.leftEye`, `.rightEye`, `.leftCheek`, `.rightCheek`,
  `.forehead`, `.jawline`, `.faceOval` (Task 1); everything from Task 3 unchanged.
- Produces: no new exports — this task only adds more `Layer` entries to the array
  already built in Task 3's `RenderCanvas`.

- [ ] **Step 1: Replace the `layers` array in `src/components/tryon/RenderCanvas.tsx`**

```tsx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const lipsPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.lips, width, height);
    const leftEyePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.leftEye, width, height);
    const rightEyePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.rightEye, width, height);
    const leftCheekPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.leftCheek, width, height);
    const rightCheekPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.rightCheek, width, height);
    const foreheadPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.forehead, width, height);
    const jawlinePolygon = landmarksToPolygon(points, ZONE_LANDMARKS.jawline, width, height);
    const faceOvalPolygon = landmarksToPolygon(points, ZONE_LANDMARKS.faceOval, width, height);

    const layers: Layer[] = [
      // Foundation: full-face, multiply, ~0.15-0.20 opacity
      {
        polygon: faceOvalPolygon,
        tintColor: hexToRgb01("#D9A876"),
        opacity: 0.18,
        blendMode: "multiply",
        featherPx: 8,
      },
      // Bronzer: temples + jawline, multiply, ~0.14-0.22, heaviest blur
      {
        polygon: [...foreheadPolygon, ...jawlinePolygon],
        tintColor: hexToRgb01("#A87552"),
        opacity: 0.18,
        blendMode: "multiply",
        featherPx: 14,
      },
      // Blush: cheek zones, multiply, ~0.32 opacity, heavy feather
      {
        polygon: leftCheekPolygon,
        tintColor: hexToRgb01("#E8A0A0"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 12,
      },
      {
        polygon: rightCheekPolygon,
        tintColor: hexToRgb01("#E8A0A0"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 12,
      },
      // Highlighter: cheekbones + nose bridge, screen, ~0.20-0.30
      {
        polygon: [...leftCheekPolygon, ...rightCheekPolygon],
        tintColor: hexToRgb01("#F0D8B8"),
        opacity: 0.25,
        blendMode: "screen",
        featherPx: 10,
      },
      // Eyeshadow: lid zones, multiply, ~0.32, tight feather
      {
        polygon: leftEyePolygon,
        tintColor: hexToRgb01("#C9A876"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 3,
      },
      {
        polygon: rightEyePolygon,
        tintColor: hexToRgb01("#C9A876"),
        opacity: 0.32,
        blendMode: "multiply",
        featherPx: 3,
      },
      // Lipstick: lip zone, multiply, ~0.55 (drawn last / on top)
      {
        polygon: lipsPolygon,
        tintColor: hexToRgb01("#B23A3A"),
        opacity: 0.55,
        blendMode: "multiply",
        featherPx: 2,
      },
    ];

    renderComposite(canvas, image, layers);
  }, [image, points, width, height]);
```

Note: combining `[...foreheadPolygon, ...jawlinePolygon]` into one `polygon` array for
the bronzer layer draws both regions with a single mask-fill call (the 2D canvas path
in `buildMaskTexture` will trace both point sets as one connected shape, which is a
simplification — the "correct" behavior would be two separate masked draws unioned
together). **Verify this visually in Step 3**: if the bronzer tint looks like it's
drawing a connecting shape between the forehead and jawline instead of two independent
regions, split this into two separate `Layer` entries (one per region, each its own
draw call) instead — same pattern already used for the two cheek layers below it.

- [ ] **Step 2: Verify build, lint, typecheck**

```bash
npm run build
npm run lint
npm run typecheck
```

Expected: all three succeed with zero errors.

- [ ] **Step 3: Verify with Playwright, visually inspect all six zones**

Repeat Task 3 Step 5's dev server + Playwright verification exactly (same script,
`webgl-screenshot.png` will be overwritten). This time, visually inspect the screenshot
for:
- Lips: tinted red/berry, confined to the lip area.
- Both eyes: tinted warm bronze, confined to the eyelid area (not spilling onto the
  eyeball/white or eyebrows).
- Cheeks: pink blush visible, confined to cheek area (not spilling past the face oval).
- Forehead/jawline: subtle warm bronzer tint (this is the layer flagged in Step 1 as
  needing visual confirmation — check whether it needs splitting into two draws).
- Overall face: subtle warm foundation tint visible across the whole face oval, not
  just at the edges.
- Nothing renders outside the face oval (e.g. onto the hair, ears, or background).

If any zone is visibly wrong (wrong location, way too strong/weak, or spilling outside
its intended region), adjust that zone's `ZONE_LANDMARKS` entry in
`src/lib/facemesh/zones.ts` (Task 1's file) or that layer's `opacity`/`featherPx` in this
file, then re-run the build + Playwright verification until it looks right. This
iterative visual check is expected — see this plan's Global Constraints note that four of
the eight zone definitions are approximations, not independently pre-verified values.

- [ ] **Step 4: Commit**

```bash
git add src/components/tryon/RenderCanvas.tsx
# also add src/lib/facemesh/zones.ts if Step 3's visual check required adjusting it
git commit -m "feat: add remaining five zones (eyes, cheeks, forehead, jawline, full-face) to demo"
git push
```

---

## Self-Review

**Spec coverage:** Design doc decision 1 (hardcoded demo layers, isolated `lib/webgl`
module) — Task 3/4's `RenderCanvas` uses real seed-catalog-style hex values (matching
actual product colors from Phase 1's `seedData.ts`, e.g. `#B23A3A` is the Rouge Pur
Couture lipstick's exact `colorHex`) rather than arbitrary colors. Decision 2 (2D-canvas
mask + blur, not multi-pass GPU blur) — Task 2's `buildMaskTexture` uses
`ctx.filter = blur(...)`. Decision 3 (fixed-function blend for multiply/screen) — Task
3's `compositor.ts` sets `gl.blendFunc` per layer, shader has no blend math. Decision 4
(zone landmark mapping) — Task 1's `zones.ts`, with the verified-vs-approximate
distinction called out explicitly. Decision 5 (7th faceOval mask for full-face products)
— Task 4 uses `ZONE_LANDMARKS.faceOval` for the foundation layer, distinct from the six
named zones. Decision 6 (vitest for pure math, Playwright for rendering) — Task 1 has
`polygon.test.ts`; Tasks 2-4 have zero vitest files, verified via Playwright instead. All
six CLAUDE.md per-category baseline blend-mode/opacity values from the Global Constraints
are represented in Task 4's layer list.

**Placeholder scan:** none — every step has literal code, exact commands, or an explicit,
concrete troubleshooting procedure for the two genuinely-uncertain-until-run details
(texture Y-flip orientation, whether the combined bronzer polygon needs splitting).

**Type consistency:** `Layer` type defined once in Task 3 (`compositor.ts`) and never
redefined — Task 4 only adds more values conforming to the same shape. `Point` from
`polygon.ts` (Task 1) is the coordinate shape used by `landmarksToPolygon`'s return value,
`Layer.polygon`, and `RenderCanvas`'s `points` prop consistently throughout. `ZoneName`
(Task 1) matches every key actually used across `ZONE_LANDMARKS.<name>` call sites in
Tasks 3 and 4 — no typos introduce a zone name that doesn't exist in the `zones.ts` map.
