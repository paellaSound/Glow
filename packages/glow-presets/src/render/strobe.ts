import type { PresetContext } from '../types.js';
import { paletteColorAt } from '../utils/palette.js';

export function renderStrobe(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const phase = Math.floor(t * 8) % 2;

  if (ctx.palette?.length) {
    return phase === 0 ? paletteColorAt(ctx, 0) : paletteColorAt(ctx, 1);
  }

  return phase === 0 ? '#ffffff' : '#ff0055';
}
