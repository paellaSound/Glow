/**
 * audio-shader — Plus 25+ visual art.
 *
 * WebGL fragment shader ported from web/visual_arts/indext.html.
 * The hardcoded neon cyan/magenta palette is replaced with uniforms
 * driven by the active palette colours.
 *
 * Falls back to an offline sine-wave simulation when no audio data arrives,
 * so the surface is never blank.
 */

import type { VisualArtController, VisualArtInput } from '../types.js';

const VERTEX_SRC = /* glsl */ `
  attribute vec2 position;
  varying vec2 v_uv;
  void main() {
    v_uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SRC = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;

  uniform float u_time;
  uniform float u_bass;
  uniform float u_treble;
  uniform vec3  u_col0;
  uniform vec3  u_col1;

  float wave(vec2 p, float frequency, float amplitude) {
    return sin(p.x * frequency + u_time * 3.0)
         * cos(p.y * frequency + u_time * 1.5)
         * amplitude;
  }

  void main() {
    vec2 uv = v_uv - 0.5;

    float noiseWave = wave(uv, 8.0, 0.4 * u_bass);
    noiseWave += wave(uv * 2.0, 16.0, 0.2 * u_treble);

    float radius = length(uv) + noiseWave;

    vec3 finalColor = mix(u_col0, u_col1, sin(radius * 10.0 + u_time) * 0.5 + 0.5);

    // Flash on bass peaks
    finalColor += vec3(1.0) * pow(u_bass, 3.0) * 0.4;

    // Dark club vignette
    finalColor *= smoothstep(0.8, 0.2, length(uv));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[audio-shader] shader compile error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function mountAudioShader(
  canvas: HTMLCanvasElement,
  getInput: () => VisualArtInput,
): VisualArtController {
  const gl = canvas.getContext('webgl');
  if (!gl) {
    console.warn('[audio-shader] WebGL not available — art cannot render');
    // Return a no-op controller; the surface will show the black canvas.
    return {
      setInput: () => undefined,
      resize: () => undefined,
      destroy: () => undefined,
    };
  }

  // Narrow type: gl is non-null past this point
  const glCtx: WebGLRenderingContext = gl;

  let rafId = 0;
  let startTime = performance.now();

  // Compile shader program
  const vs = createShader(glCtx, glCtx.VERTEX_SHADER, VERTEX_SRC);
  const fs = createShader(glCtx, glCtx.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) {
    return { setInput: () => undefined, resize: () => undefined, destroy: () => undefined };
  }

  const program = glCtx.createProgram()!;
  glCtx.attachShader(program, vs);
  glCtx.attachShader(program, fs);
  glCtx.linkProgram(program);
  if (!glCtx.getProgramParameter(program, glCtx.LINK_STATUS)) {
    console.error('[audio-shader] link error:', glCtx.getProgramInfoLog(program));
    return { setInput: () => undefined, resize: () => undefined, destroy: () => undefined };
  }
  glCtx.useProgram(program);

  // Geometry — full-screen quad
  const buf = glCtx.createBuffer()!;
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buf);
  glCtx.bufferData(
    glCtx.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    glCtx.STATIC_DRAW,
  );
  const posLoc = glCtx.getAttribLocation(program, 'position');
  glCtx.enableVertexAttribArray(posLoc);
  glCtx.vertexAttribPointer(posLoc, 2, glCtx.FLOAT, false, 0, 0);

  // Uniform locations
  const uTime   = glCtx.getUniformLocation(program, 'u_time');
  const uBass   = glCtx.getUniformLocation(program, 'u_bass');
  const uTreble = glCtx.getUniformLocation(program, 'u_treble');
  const uCol0   = glCtx.getUniformLocation(program, 'u_col0');
  const uCol1   = glCtx.getUniformLocation(program, 'u_col1');

  function resize() {
    canvas.width  = canvas.clientWidth  * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    glCtx.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(nowMs: number) {
    const input = getInput();
    const t = (nowMs - startTime) / 1000;

    // Audio or offline fallback
    let bass   = input.audio ? input.audio.bass   : 0.3 + 0.3 * Math.sin(t * 2.5);
    let treble = input.audio ? input.audio.treble : 0.2 + 0.2 * Math.cos(t * 5.0);
    bass   = Math.min(1, Math.max(0, bass));
    treble = Math.min(1, Math.max(0, treble));

    // Palette — use first two colours (or duplicate if only one)
    const palette = input.palette.length > 0 ? input.palette : ['#00e3ff', '#ff00c8'];
    const c0 = hexToVec3(palette[0]);
    const c1 = hexToVec3(palette.length > 1 ? palette[1] : palette[0]);

    glCtx.uniform1f(uTime,   t);
    glCtx.uniform1f(uBass,   bass);
    glCtx.uniform1f(uTreble, treble);
    glCtx.uniform3fv(uCol0,  c0);
    glCtx.uniform3fv(uCol1,  c1);
    glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);

    rafId = requestAnimationFrame(render);
  }

  resize();
  rafId = requestAnimationFrame(render);

  return {
    setInput: (_input: VisualArtInput) => { /* art pulls via getInput() each frame */ },
    resize,
    destroy: () => {
      cancelAnimationFrame(rafId);
      const ext = glCtx.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
