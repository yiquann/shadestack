import type { Point } from "@/lib/facemesh/polygon";
import {
  BASE_VERTEX_SHADER,
  IMAGE_FRAGMENT_SHADER,
  TINT_FRAGMENT_SHADER,
  SMOOTH_FRAGMENT_SHADER,
  createProgram,
} from "./shaders";
import { drawMask } from "./maskTexture";

export type BlendMode = "multiply" | "screen";

export type TintLayer = {
  kind: "tint";
  polygon: Point[];
  tintColor: [number, number, number];
  opacity: number;
  blendMode: BlendMode;
  featherPx: number;
  clipMask?: CanvasImageSource;
  regionClip?: CanvasImageSource;
};

export type SmoothLayer = {
  kind: "smooth";
  polygon: Point[];
  strength: number;
  featherPx: number;
  // Regions to exclude from smoothing (e.g. eyes/lips for a full-face
  // foundation blur) so facial features stay sharp instead of reading as a
  // resolution drop. Punched out of the mask under the same feather.
  holes?: Point[][];
  clipMask?: CanvasImageSource;
  regionClip?: CanvasImageSource;
};

export type Layer = TintLayer | SmoothLayer;

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

// Blur offset at a ~600px canvas; scaled with the actual canvas in render() so
// the smoothing stays visually consistent as the render resolution changes.
const SMOOTH_RADIUS = 2.5;
const SMOOTH_RADIUS_REFERENCE = 600;

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
  const glOrNull = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!glOrNull) throw new Error("WebGL is not supported in this browser");
  // Re-bind to a definitely-non-null const: TS narrowing on `glOrNull` does
  // not propagate into the nested closures below (bindQuad, maskTextureAt,
  // render, dispose), since they could in principle run at any later time.
  // Assigning here gives `gl` a non-nullable declared type from the start.
  const gl = glOrNull;

  // See phase 4 report: FLIP_Y=true rendered the face upside-down and
  // misaligned with the (non-flipped) landmark masks. Keep it false.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const imageProgram = createProgram(gl, BASE_VERTEX_SHADER, IMAGE_FRAGMENT_SHADER);
  const tintProgram = createProgram(gl, BASE_VERTEX_SHADER, TINT_FRAGMENT_SHADER);
  const smoothProgram = createProgram(gl, BASE_VERTEX_SHADER, SMOOTH_FRAGMENT_SHADER);

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
  const smoothLoc = {
    position: gl.getAttribLocation(smoothProgram, "aPosition"),
    texCoord: gl.getAttribLocation(smoothProgram, "aTexCoord"),
    uImage: gl.getUniformLocation(smoothProgram, "uImage"),
    uMask: gl.getUniformLocation(smoothProgram, "uMask"),
    uStrength: gl.getUniformLocation(smoothProgram, "uStrength"),
    uTexel: gl.getUniformLocation(smoothProgram, "uTexel"),
    uRadius: gl.getUniformLocation(smoothProgram, "uRadius"),
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

    // Layer passes. Premultiplied source in both the tint and smooth shaders:
    //   multiply -> (DST_COLOR, ONE_MINUS_SRC_ALPHA); screen -> (ONE, ONE_MINUS_SRC_COLOR)
    //   smooth (skin blur "over") -> (ONE, ONE_MINUS_SRC_ALPHA)
    //   alpha factors (ZERO, ONE) preserve the opaque base alpha.
    gl.enable(gl.BLEND);
    layers.forEach((layer, i) => {
      const maskTexture = maskTextureAt(i);
      drawMask(
        maskScratch,
        layer.polygon,
        width,
        height,
        layer.featherPx,
        layer.kind === "smooth" ? layer.holes : undefined,
        layer.clipMask,
        layer.regionClip
      );

      if (layer.kind === "smooth") {
        gl.useProgram(smoothProgram);
        bindQuad(smoothLoc.position, smoothLoc.texCoord);
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.uniform1i(smoothLoc.uImage, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, maskTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskScratch);
        gl.uniform1i(smoothLoc.uMask, 1);
        gl.uniform1f(smoothLoc.uStrength, layer.strength);
        gl.uniform2f(smoothLoc.uTexel, 1 / width, 1 / height);
        gl.uniform1f(
          smoothLoc.uRadius,
          (SMOOTH_RADIUS * Math.max(width, height)) / SMOOTH_RADIUS_REFERENCE
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return;
      }

      // kind === "tint": the existing tint draw, unchanged.
      gl.useProgram(tintProgram);
      bindQuad(tintLoc.position, tintLoc.texCoord);
      if (layer.blendMode === "multiply") {
        gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      } else {
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
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
    gl.deleteProgram(smoothProgram);
  }

  return { render, dispose };
}
