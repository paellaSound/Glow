import { computePresetColor } from './compute.js';
import { FALLBACK_PRESET_ID } from './constants.js';
import { hashSeed } from './utils/color.js';
export { FALLBACK_PRESET_ID };
export function computeFallbackColor(roomCode, seedTimestamp, row, col, now) {
    const elapsed = now - seedTimestamp;
    const seed = hashSeed(`${roomCode}:${seedTimestamp}`);
    return computePresetColor(FALLBACK_PRESET_ID, {
        row,
        col,
        timeMs: elapsed,
        seed,
        matrixRows: 25,
        matrixCols: 25,
    });
}
