import type { PresetContext } from '../types.js';

export function renderFlash(ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  return Math.floor(t * 2) % 2 === 0 ? '#ffffff' : '#000000';
}
