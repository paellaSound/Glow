import type { PresetContext } from '../types.js';
import { lerpHex } from '../utils/color.js';
import { paletteColorAt } from '../utils/palette.js';

export function renderPulse(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const pulse = (Math.sin(t * 4) + 1) / 2;

  if (ctx.palette?.length) {
    return lerpHex('#000000', paletteColorAt(ctx, 0), pulse);
  }

  const v = Math.round(pulse * 255);
  return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
}
