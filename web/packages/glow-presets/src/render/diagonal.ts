import type { PresetContext } from '../types.js';
import { paletteColorAt } from '../utils/palette.js';

export function renderDiagonal(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const x = ctx.col;
  const y = ctx.row;
  const phase = x + y + Math.floor(t * 3);

  if (ctx.palette?.length) {
    return paletteColorAt(ctx, phase);
  }

  const mod = phase % 3;
  return mod === 0 ? '#ff0055' : mod === 1 ? '#00ffcc' : '#0055ff';
}
