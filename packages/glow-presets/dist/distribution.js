import { hashSeed } from './utils/color.js';
import { computePresetColor } from './compute.js';
export function validateDistributionWeights(effects) {
    if (effects.length === 0)
        return false;
    const sum = effects.reduce((acc, effect) => acc + effect.weight, 0);
    return Math.abs(sum - 100) < 0.01 && effects.every((e) => e.weight > 0);
}
/** Deterministic bucket 0..99 from device id + seed */
export function distributionBucket(deviceKey, seedTimestamp) {
    return hashSeed(`${deviceKey}:${seedTimestamp}`) % 100;
}
export function pickEffectForDevice(distribution, deviceKey) {
    const bucket = distributionBucket(deviceKey, distribution.seedTimestamp);
    let cumulative = 0;
    for (const effect of distribution.effects) {
        cumulative += effect.weight;
        if (bucket < cumulative) {
            return effect;
        }
    }
    return distribution.effects[distribution.effects.length - 1];
}
export function computeDistributionColor(distribution, ctx, deviceKey) {
    const effect = pickEffectForDevice(distribution, deviceKey);
    return computePresetColor(effect.presetId, {
        row: ctx.row,
        col: ctx.col,
        timeMs: ctx.timeMs,
        seed: distribution.seedTimestamp,
        matrixRows: distribution.matrix.rows,
        matrixCols: distribution.matrix.cols,
        palette: effect.params?.palette,
        audio: effect.presetId === 'audio' ? ctx.audio : undefined,
    });
}
/** Preview helper: map row/col cell index to a synthetic device key */
export function previewDeviceKey(row, col, matrixCols) {
    return `preview-${row * matrixCols + col}`;
}
