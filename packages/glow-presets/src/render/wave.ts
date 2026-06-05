import type { PresetContext } from '../types.js';
import { hslToHex } from '../utils/color.js';

export function renderWave(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const x = ctx.col;
  const y = ctx.row;
  const hue = (x * 20 + y * 15 + t * 80 + ctx.seed) % 360;
  return hslToHex(hue, 100, 50);
}
