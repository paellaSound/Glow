import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_VISUAL_ART_ID,
  getVisualArt,
  isValidVisualArtId,
  VISUAL_ART_REGISTRY,
  visualArtsForPlan,
} from '../dist/index.js';

describe('VISUAL_ART_REGISTRY', () => {
  it('contains audio-shader only', () => {
    assert.deepEqual(Object.keys(VISUAL_ART_REGISTRY), ['audio-shader']);
  });
});

describe('isValidVisualArtId', () => {
  it('returns true for known ids', () => {
    assert.equal(isValidVisualArtId('audio-shader'), true);
  });
  it('returns false for unknown or removed ids', () => {
    assert.equal(isValidVisualArtId(''), false);
    assert.equal(isValidVisualArtId('glow-branded'), false);
    assert.equal(isValidVisualArtId('pulse-grid'), false);
    assert.equal(isValidVisualArtId('neon-tunnel'), false);
  });
});

describe('getVisualArt', () => {
  it('returns the definition for a valid id', () => {
    const art = getVisualArt('audio-shader');
    assert.ok(art);
    assert.equal(art.id, 'audio-shader');
    assert.equal(art.minTier, 'free');
  });
  it('returns undefined for an invalid id', () => {
    assert.equal(getVisualArt('not-an-art'), undefined);
  });
});

describe('DEFAULT_VISUAL_ART_ID', () => {
  it('is a registered art', () => {
    assert.equal(isValidVisualArtId(DEFAULT_VISUAL_ART_ID), true);
  });
});

describe('visualArtsForPlan', () => {
  it('every tier gets audio-shader', () => {
    for (const plan of ['free', 'plus_25', 'plus_50', 'pro']) {
      assert.deepEqual(visualArtsForPlan(plan), ['audio-shader']);
    }
  });

  it('unknown plan → falls back to free', () => {
    assert.deepEqual(visualArtsForPlan('enterprise_unknown'), visualArtsForPlan('free'));
  });
});
