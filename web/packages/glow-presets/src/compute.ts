import { getPreset, isValidPresetId } from './registry.js';
import type { PresetContext } from './types.js';

export function computePresetColor(presetId: string, ctx: PresetContext): string {
  if (!isValidPresetId(presetId)) {
    return '#111111';
  }

  return getPreset(presetId)!.render(ctx);
}
