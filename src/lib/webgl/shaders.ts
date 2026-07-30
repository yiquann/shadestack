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
  float a = maskAlpha * uOpacity;
  // Premultiply alpha into RGB so the compositor's blend factors can localize
  // the multiply/screen effect to the mask (outside the mask, a=0 so this
  // contributes (0,0,0,0), leaving the destination untouched).
  gl_FragColor = vec4(uTintColor * a, a);
}
`;

export const SMOOTH_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform float uStrength;
uniform vec2 uTexel;   // (1/canvasWidth, 1/canvasHeight)
uniform float uRadius; // blur offset in pixels
void main() {
  float a = texture2D(uMask, vTexCoord).a * uStrength;
  vec2 o = uTexel * uRadius;
  vec3 c = texture2D(uImage, vTexCoord).rgb * 0.25;
  c += texture2D(uImage, vTexCoord + vec2( o.x, 0.0)).rgb * 0.125;
  c += texture2D(uImage, vTexCoord + vec2(-o.x, 0.0)).rgb * 0.125;
  c += texture2D(uImage, vTexCoord + vec2(0.0,  o.y)).rgb * 0.125;
  c += texture2D(uImage, vTexCoord + vec2(0.0, -o.y)).rgb * 0.125;
  c += texture2D(uImage, vTexCoord + vec2( o.x,  o.y)).rgb * 0.0625;
  c += texture2D(uImage, vTexCoord + vec2(-o.x,  o.y)).rgb * 0.0625;
  c += texture2D(uImage, vTexCoord + vec2( o.x, -o.y)).rgb * 0.0625;
  c += texture2D(uImage, vTexCoord + vec2(-o.x, -o.y)).rgb * 0.0625;
  gl_FragColor = vec4(c * a, a);
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
