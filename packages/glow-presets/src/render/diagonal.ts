import type { PresetContext } from '../types.js';

export function renderDiagonal(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const x = ctx.col;
  const y = ctx.row;
  const phase = (x + y + Math.floor(t * 3)) % 3;
  return phase === 0 ? '#ff0055' : phase === 1 ? '#00ffcc' : '#0055ff';
}
