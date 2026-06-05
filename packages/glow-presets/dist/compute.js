import { getPreset, isValidPresetId } from './registry.js';
export function computePresetColor(presetId, ctx) {
    if (!isValidPresetId(presetId)) {
        return '#111111';
    }
    return getPreset(presetId).render(ctx);
}
