import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compositeColors,
  computeEffectStackColor,
  hexToRgb,
  rgbToHex,
} from '../src/compositor.js';
import { isValidHexColor } from '../src/utils/color.js';
import type { EffectStack, PresetContext } from '../src/types.js';

const baseCtx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'> = {
  row: 0,
  col: 0,
  timeMs: 0,
};

describe('compositor', () => {
  it('hexToRgb and rgbToHex round-trip', () => {
    const rgb = hexToRgb('#ff0055');
    assert.deepEqual(rgb, { r: 255, g: 0, b: 85 });
    assert.equal(rgbToHex(rgb), '#ff0055');
  });

  it('normal blend with full opacity replaces base', () => {
    assert.equal(compositeColors('#000000', '#ff0000', 'normal', 1), '#ff0000');
  });

  it('normal blend with half opacity mixes evenly', () => {
    assert.equal(compositeColors('#000000', '#ffffff', 'normal', 0.5), '#808080');
  });

  it('add blend accumulates channels', () => {
    assert.equal(compositeColors('#808080', '#808080', 'add', 1), '#ffffff');
  });

  it('multiply blend darkens against white base', () => {
    const result = compositeColors('#ffffff', '#808080', 'multiply', 1);
    assert.equal(result, '#808080');
  });

  it('screen blend lightens against black base', () => {
    const result = compositeColors('#000000', '#808080', 'screen', 1);
    assert.equal(result, '#808080');
  });

  it('computeEffectStackColor composites bottom to top', () => {
    const stack: EffectStack = {
      seedTimestamp: 100,
      targetTimestamp: 0,
      matrix: { rows: 1, cols: 1 },
      layers: [
        {
          presetId: 'solid',
          blend: 'normal',
          opacity: 1,
          params: { palette: ['#ff0000'] },
        },
        {
          presetId: 'solid',
          blend: 'normal',
          opacity: 0.5,
          params: { palette: ['#0000ff'] },
        },
      ],
    };

    const color = computeEffectStackColor(stack, baseCtx);
    assert.ok(isValidHexColor(color));
    assert.notEqual(color, '#ff0000');
    assert.notEqual(color, '#0000ff');
  });

  it('single-layer stack matches preset color with palette', () => {
    const stack: EffectStack = {
      seedTimestamp: 100,
      targetTimestamp: 0,
      matrix: { rows: 1, cols: 1 },
      layers: [
        {
          presetId: 'solid',
          blend: 'normal',
          opacity: 1,
          params: { palette: ['#00ff00'] },
        },
      ],
    };

    assert.equal(computeEffectStackColor(stack, baseCtx), '#00ff00');
  });
});
