import type { PresetContext } from '../types.js';
import { paletteColorForCell } from '../utils/palette.js';

export function renderSolid(ctx: PresetContext): string {
  if (ctx.palette?.length) {
    return paletteColorForCell(ctx);
  }
  return '#ff0055';
}
