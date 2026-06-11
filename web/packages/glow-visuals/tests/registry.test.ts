import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  getVisualArt,
  isValidVisualArtId,
  VISUAL_ART_REGISTRY,
  visualArtsForPlan,
} from '../dist/index.js';

describe('VISUAL_ART_REGISTRY', () => {
  it('contains glow-branded, pulse-grid, audio-shader', () => {
    assert.ok('glow-branded' in VISUAL_ART_REGISTRY);
    assert.ok('pulse-grid' in VISUAL_ART_REGISTRY);
    assert.ok('audio-shader' in VISUAL_ART_REGISTRY);
  });
});

describe('isValidVisualArtId', () => {
  it('returns true for known ids', () => {
    assert.equal(isValidVisualArtId('glow-branded'), true);
    assert.equal(isValidVisualArtId('pulse-grid'), true);
    assert.equal(isValidVisualArtId('audio-shader'), true);
  });
  it('returns false for unknown ids', () => {
    assert.equal(isValidVisualArtId(''), false);
    assert.equal(isValidVisualArtId('neon-tunnel'), false);
    assert.equal(isValidVisualArtId('solid'), false);
  });
});

describe('getVisualArt', () => {
  it('returns the definition for a valid id', () => {
    const art = getVisualArt('glow-branded');
    assert.ok(art);
    assert.equal(art.id, 'glow-branded');
    assert.equal(art.minTier, 'free');
  });
  it('returns undefined for an invalid id', () => {
    assert.equal(getVisualArt('not-an-art'), undefined);
  });
});

describe('visualArtsForPlan', () => {
  it('free → only glow-branded', () => {
    const ids = visualArtsForPlan('free');
    assert.deepEqual(ids, ['glow-branded']);
  });

  it('plus_25 → glow-branded + pulse-grid + audio-shader', () => {
    const ids = visualArtsForPlan('plus_25');
    assert.ok(ids.includes('glow-branded'));
    assert.ok(ids.includes('pulse-grid'));
    assert.ok(ids.includes('audio-shader'));
  });

  it('plus_50 → same as plus_25 (no new arts at this tier)', () => {
    const free = visualArtsForPlan('free');
    const p50  = visualArtsForPlan('plus_50');
    assert.ok(p50.length >= free.length);
    assert.ok(p50.includes('glow-branded'));
    assert.ok(p50.includes('pulse-grid'));
  });

  it('pro → all arts', () => {
    const pro = visualArtsForPlan('pro');
    assert.ok(pro.includes('glow-branded'));
    assert.ok(pro.includes('pulse-grid'));
    assert.ok(pro.includes('audio-shader'));
  });

  it('unknown plan → falls back to free', () => {
    const ids = visualArtsForPlan('enterprise_unknown');
    assert.deepEqual(ids, visualArtsForPlan('free'));
  });
});
