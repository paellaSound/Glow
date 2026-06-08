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
    matrix: {
        rows: number;
        cols: number;
    };
};
export declare function validateDistributionWeights(effects: DistributionEffect[]): boolean;
/** Deterministic bucket 0..99 from device id + seed */
export declare function distributionBucket(deviceKey: string, seedTimestamp: number): number;
export declare function pickEffectForDevice(distribution: EffectDistribution, deviceKey: string): DistributionEffect;
export declare function computeDistributionColor(distribution: EffectDistribution, ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>, deviceKey: string): string;
/** Preview helper: map row/col cell index to a synthetic device key */
export declare function previewDeviceKey(row: number, col: number, matrixCols: number): string;
