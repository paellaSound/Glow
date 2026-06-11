import { hashSeed } from './utils/color.js';
import { computePresetColor } from './compute.js';
import type { PresetContext, PresetId, PresetParams } from './types.js';

export type DistributionEffect = {
  presetId: PresetId;
  params?: PresetParams;
  /** Audience share 0–100; active effects must sum to 100 */
  weight: number;
};

export type EffectDistribution = {
  effects: DistributionEffect[];
  seedTimestamp: number;
  targetTimestamp: number;
  matrix: { rows: number; cols: number };
};

export function validateDistributionWeights(effects: DistributionEffect[]): boolean {
  if (effects.length === 0) return false;
  const sum = effects.reduce((acc, effect) => acc + effect.weight, 0);
  return Math.abs(sum - 100) < 0.01 && effects.every((e) => e.weight > 0);
}

/** Deterministic bucket 0..99 from device id + seed */
export function distributionBucket(deviceKey: string, seedTimestamp: number): number {
  return hashSeed(`${deviceKey}:${seedTimestamp}`) % 100;
}

export function pickEffectForDevice(
  distribution: EffectDistribution,
  deviceKey: string
): DistributionEffect {
  const bucket = distributionBucket(deviceKey, distribution.seedTimestamp);
  let cumulative = 0;
  for (const effect of distribution.effects) {
    cumulative += effect.weight;
    if (bucket < cumulative) {
      return effect;
    }
  }
  return distribution.effects[distribution.effects.length - 1]!;
}

export function computeDistributionColor(
  distribution: EffectDistribution,
  ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>,
  deviceKey: string
): string {
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
export function previewDeviceKey(row: number, col: number, matrixCols: number): string {
  return `preview-${row * matrixCols + col}`;
}
