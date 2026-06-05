import type { PresetContext } from '../types.js';

export function renderStrobe(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  return Math.floor(t * 8) % 2 === 0 ? '#ffffff' : '#ff0055';
}
