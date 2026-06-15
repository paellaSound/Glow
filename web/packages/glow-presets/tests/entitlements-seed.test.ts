import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidPresetId } from '../src/index.js';

// Modelo 2026-06: todas las features (incl. presets) están desbloqueadas en todos
// los planes. El set completo es idéntico en free/plus_25/plus_50/pro.
const FULL_PRESET_SET = ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'];
const PLAN_SEED_PRESETS: Record<string, string[]> = {
  free: FULL_PRESET_SET,
  plus_25: FULL_PRESET_SET,
  plus_50: FULL_PRESET_SET,
  pro: FULL_PRESET_SET,
};

describe('entitlements seed alignment', () => {
  for (const [planCode, presetIds] of Object.entries(PLAN_SEED_PRESETS)) {
    it(`${planCode} seed presets exist in registry`, () => {
      for (const presetId of presetIds) {
        assert.equal(
          isValidPresetId(presetId),
          true,
          `${planCode} references unknown preset "${presetId}"`
        );
      }
    });
  }
});
