import type { PresetContext } from '../types.js';
import { hslToHex } from '../utils/color.js';

export function renderAudio(ctx: PresetContext): string {
  const audio = ctx.audio;
  if (!audio) {
    return '#111111';
  }

  const t = ctx.timeMs / 1000;
  const x = ctx.col;
  const y = ctx.row;
  const bassBoost = audio.bass * 120;
  const trebleFlash = audio.treble > 0.7 ? 15 : 0;
  const hue = (bassBoost + t * 40 + x * 10 + y * 8 + ctx.seed) % 360;
  const lightness = Math.min(85, 25 + audio.energy * 55 + trebleFlash);

  return hslToHex(hue, 100, lightness);
}
