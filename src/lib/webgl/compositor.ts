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
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL is not supported in this browser");

  // Per the task brief's troubleshooting note: with UNPACK_FLIP_Y_WEBGL set to
  // true, the rendered face came out upside-down and misaligned with the
  // landmark-derived mask (which is computed in normal, non-flipped canvas
  // space), verified via an actual Playwright screenshot. Setting this to
  // false fixes both the orientation and the mask alignment.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const imageProgram = createProgram(gl, BASE_VERTEX_SHADER, IMAGE_FRAGMENT_SHADER);
  const tintProgram = createProgram(gl, BASE_VERTEX_SHADER, TINT_FRAGMENT_SHADER);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  function bindQuadAttributes(gl: WebGLRenderingContext, program: WebGLProgram) {
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
  bindQuadAttributes(gl, imageProgram);
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
  bindQuadAttributes(gl, tintProgram);
  const maskTextures: WebGLTexture[] = [];
  for (const layer of layers) {
    // TINT_FRAGMENT_SHADER outputs premultiplied color (uTintColor * a, a),
    // where a = maskAlpha * opacity. With that premultiplication:
    //   multiply: result = dst*(1 - a + a*tintColor)
    //     via RGB factors (DST_COLOR, ONE_MINUS_SRC_ALPHA)
    //   screen:   result = a*tintColor + dst*(1 - a*tintColor)
    //     via RGB factors (ONE, ONE_MINUS_SRC_COLOR) — unchanged, since the
    //     premultiplied source already carries the mask.
    // Both use alpha factors (ZERO, ONE) so the destination alpha (opaque,
    // from the base image draw) is preserved rather than being multiplied by
    // the tint layer's alpha — verified empirically via Playwright pixel
    // readback (see task-3-report.md): without this, the canvas's alpha (and,
    // pre-premultiplication, its RGB) would be affected far outside each
    // layer's mask instead of being localized to it.
    if (layer.blendMode === "multiply") {
      gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    } else {
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
    }
    const maskTexture = buildMaskTexture(gl, layer.polygon, canvas.width, canvas.height, layer.featherPx);
    maskTextures.push(maskTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(gl.getUniformLocation(tintProgram, "uMask"), 0);
    gl.uniform3fv(gl.getUniformLocation(tintProgram, "uTintColor"), layer.tintColor);
    gl.uniform1f(gl.getUniformLocation(tintProgram, "uOpacity"), layer.opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Every call to this function creates a fresh set of GL objects (shader
  // programs, the quad buffer, the image texture, one mask texture per
  // layer). With layers now changing on every opacity-slider drag tick
  // (Phase 5), leaving these allocated would leak GPU resources and
  // recompile both shader programs many times per second. Delete everything
  // created in this call now that it has been drawn to the canvas.
  for (const maskTexture of maskTextures) {
    gl.deleteTexture(maskTexture);
  }
  gl.deleteTexture(imageTexture);
  gl.deleteBuffer(quadBuffer);
  gl.deleteProgram(imageProgram);
  gl.deleteProgram(tintProgram);
}
