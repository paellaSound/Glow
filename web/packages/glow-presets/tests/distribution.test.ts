import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeDistributionColor,
  distributionBucket,
  pickEffectForDevice,
  validateDistributionWeights,
} from '../src/distribution.js';

describe('distribution', () => {
  const distribution = {
    effects: [
      { presetId: 'wave' as const, weight: 60, params: { palette: ['#ff0000'] } },
      { presetId: 'flash' as const, weight: 25, params: { palette: ['#00ff00'] } },
      { presetId: 'pulse' as const, weight: 15, params: { palette: ['#0000ff'] } },
    ],
    seedTimestamp: 12345,
    targetTimestamp: 0,
    matrix: { rows: 1, cols: 1 },
  };

  it('validateDistributionWeights accepts 100% totals', () => {
    assert.equal(validateDistributionWeights(distribution.effects), true);
  });

  it('pickEffectForDevice is deterministic', () => {
    const first = pickEffectForDevice(distribution, 'device-abc');
    const second = pickEffectForDevice(distribution, 'device-abc');
    assert.deepEqual(first, second);
  });

  it('distributionBucket stays within 0..99', () => {
    const bucket = distributionBucket('device-abc', 12345);
    assert.ok(bucket >= 0 && bucket <= 99);
  });

  it('computeDistributionColor returns valid hex', () => {
    const color = computeDistributionColor(
      distribution,
      { row: 0, col: 0, timeMs: 0 },
      'device-abc'
    );
    assert.match(color, /^#[0-9a-f]{6}$/i);
  });
});
