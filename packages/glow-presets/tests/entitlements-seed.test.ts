import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidPresetId } from '../src/index.js';

const PLAN_SEED_PRESETS: Record<string, string[]> = {
  free: ['solid', 'flash', 'pulse', 'audio'],
  plus_25: ['solid', 'flash', 'pulse', 'wave', 'rainbow'],
  plus_50: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'audio'],
  pro: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'],
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
