import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computePresetColor, computeFallbackColor, isValidPresetId, presetsForPlan } from '../src/index.js';
import { renderAudio } from '../src/render/audio.js';
import { isValidHexColor } from '../src/utils/color.js';
import type { PresetContext } from '../src/types.js';

const baseCtx: PresetContext = {
  row: 0,
  col: 0,
  timeMs: 0,
  seed: 100,
  matrixRows: 1,
  matrixCols: 1,
};

describe('presets', () => {
  it('returns valid hex colors for all presets', () => {
    for (const presetId of presetsForPlan('pro')) {
      const color = computePresetColor(presetId, { ...baseCtx, timeMs: 500 });
      assert.ok(isValidHexColor(color), `${presetId} returned invalid color: ${color}`);
    }
  });

  it('golden: solid is constant', () => {
    assert.equal(computePresetColor('solid', baseCtx), '#ff0055');
  });

  it('golden: pulse at t=0', () => {
    assert.equal(computePresetColor('pulse', baseCtx), '#808080');
  });

  it('golden: wave at fixed context', () => {
    assert.equal(computePresetColor('wave', baseCtx), '#55ff00');
  });

  it('golden: flash alternates', () => {
    assert.equal(computePresetColor('flash', baseCtx), '#ffffff');
    assert.equal(computePresetColor('flash', { ...baseCtx, timeMs: 500 }), '#000000');
  });

  it('audio without features returns dark base', () => {
    assert.equal(computePresetColor('audio', baseCtx), '#111111');
  });

  it('audio with mock features is deterministic', () => {
    const color = renderAudio({
      ...baseCtx,
      audio: { bass: 0.8, mid: 0.4, treble: 0.2, energy: 0.5 },
    });
    assert.equal(color, '#0dbeff');
    assert.ok(isValidHexColor(color));
  });

  it('presetsForPlan free includes audio but excludes wave', () => {
    const freePresets = presetsForPlan('free');
    assert.ok(!freePresets.includes('wave'));
    assert.ok(freePresets.includes('audio'));
    assert.deepEqual(freePresets, ['solid', 'flash', 'pulse', 'audio']);
  });

  it('presetsForPlan plus_50 includes audio', () => {
    const presets = presetsForPlan('plus_50');
    assert.ok(presets.includes('audio'));
  });

  it('isValidPresetId rejects unknown ids', () => {
    assert.equal(isValidPresetId('unknown'), false);
    assert.equal(isValidPresetId('wave'), true);
  });

  it('fallback uses wave math', () => {
    const color = computeFallbackColor('ABC123', 1000, 0, 0, 1000);
    assert.ok(isValidHexColor(color));
  });
});
