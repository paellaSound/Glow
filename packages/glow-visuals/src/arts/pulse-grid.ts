/**
 * pulse-grid — Plus 25+ visual art.
 *
 * A Canvas2D grid of cells that pulse between the palette colours.
 * Each cell has an independent phase offset so the wave rolls across the grid.
 * Reacts to audio bass when available (cell brightness driven by bass energy).
 */

import type { VisualArtController, VisualArtInput } from '../types.js';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function mountPulseGrid(
  canvas: HTMLCanvasElement,
  getInput: () => VisualArtInput,
): VisualArtController {
  const ctx = canvas.getContext('2d')!;
  let rafId = 0;
  let startTime = performance.now();

  // Configurable via params
  const COLS = 12;
  const ROWS = 8;

  function resize() {
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
  }

  function render(nowMs: number) {
    const input = getInput();
    const t = (nowMs - startTime) / 1000;
    const w = canvas.width;
    const h = canvas.height;

    // Palette — at least 2 colours
    const palette = input.palette.length > 0 ? input.palette : ['#7c3aed', '#06b6d4'];
    const colors = palette.map(hexToRgb);
    const bassBoost = input.audio ? input.audio.bass * 0.6 : 0;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const cellW = w / COLS;
    const cellH = h / ROWS;
    const gap = 3;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Phase offset creates rolling wave diagonally
        const phase = (row + col) / (ROWS + COLS);
        const wave = Math.sin(t * 1.5 + phase * Math.PI * 4) * 0.5 + 0.5;
        const brightness = Math.min(1, wave + bassBoost);

        // Cycle through palette colours
        const colourT = (Math.sin(t * 0.4 + phase * Math.PI * 2) * 0.5 + 0.5);
        const colorIndex = colourT * (colors.length - 1);
        const c0 = colors[Math.floor(colorIndex)] ?? colors[0];
        const c1 = colors[Math.ceil(colorIndex)] ?? colors[colors.length - 1];
        const blended = lerpColor(c0, c1, colorIndex % 1);

        const alpha = 0.1 + brightness * 0.9;
        ctx.fillStyle = `rgba(${blended[0]},${blended[1]},${blended[2]},${alpha})`;
        ctx.fillRect(
          col * cellW + gap,
          row * cellH + gap,
          cellW - gap * 2,
          cellH - gap * 2,
        );
      }
    }

    rafId = requestAnimationFrame(render);
  }

  resize();
  rafId = requestAnimationFrame(render);

  return {
    setInput: (_input: VisualArtInput) => { /* art pulls via getInput() each frame */ },
    resize,
    destroy: () => {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
