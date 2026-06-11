import { computePresetColor } from './compute.js';
import type { EffectBlendMode, EffectLayer, EffectStack, PresetContext } from './types.js';

type Rgb = { r: number; g: number; b: number };

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${clampByte(r).toString(16).padStart(2, '0')}${clampByte(g)
    .toString(16)
    .padStart(2, '0')}${clampByte(b).toString(16).padStart(2, '0')}`;
}

function normalizeOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function blendNormal(base: Rgb | null, src: Rgb, opacity: number): Rgb {
  const alpha = normalizeOpacity(opacity);
  if (!base) {
    return { r: src.r * alpha, g: src.g * alpha, b: src.b * alpha };
  }
  return {
    r: src.r * alpha + base.r * (1 - alpha),
    g: src.g * alpha + base.g * (1 - alpha),
    b: src.b * alpha + base.b * (1 - alpha),
  };
}

function blendAdd(base: Rgb | null, src: Rgb, opacity: number): Rgb {
  const alpha = normalizeOpacity(opacity);
  if (!base) {
    return { r: src.r * alpha, g: src.g * alpha, b: src.b * alpha };
  }
  return {
    r: Math.min(255, base.r + src.r * alpha),
    g: Math.min(255, base.g + src.g * alpha),
    b: Math.min(255, base.b + src.b * alpha),
  };
}

function blendScreen(base: Rgb | null, src: Rgb, opacity: number): Rgb {
  const alpha = normalizeOpacity(opacity);
  const source = { r: src.r / 255, g: src.g / 255, b: src.b / 255 };

  if (!base) {
    return {
      r: source.r * alpha * 255,
      g: source.g * alpha * 255,
      b: source.b * alpha * 255,
    };
  }

  const dest = { r: base.r / 255, g: base.g / 255, b: base.b / 255 };
  const channel = (d: number, s: number) => (1 - (1 - d) * (1 - s * alpha)) * 255;

  return {
    r: channel(dest.r, source.r),
    g: channel(dest.g, source.g),
    b: channel(dest.b, source.b),
  };
}

function blendMultiply(base: Rgb | null, src: Rgb, opacity: number): Rgb {
  const alpha = normalizeOpacity(opacity);
  const source = { r: src.r / 255, g: src.g / 255, b: src.b / 255 };

  if (!base) {
    return {
      r: source.r * alpha * 255,
      g: source.g * alpha * 255,
      b: source.b * alpha * 255,
    };
  }

  const dest = { r: base.r / 255, g: base.g / 255, b: base.b / 255 };
  const channel = (d: number, s: number) => d * (1 - alpha + s * alpha) * 255;

  return {
    r: channel(dest.r, source.r),
    g: channel(dest.g, source.g),
    b: channel(dest.b, source.b),
  };
}

export function compositeColors(
  baseHex: string | null,
  overlayHex: string,
  blend: EffectBlendMode,
  opacity: number
): string {
  const base = baseHex ? hexToRgb(baseHex) : null;
  const overlay = hexToRgb(overlayHex);

  let result: Rgb;
  switch (blend) {
    case 'add':
      result = blendAdd(base, overlay, opacity);
      break;
    case 'screen':
      result = blendScreen(base, overlay, opacity);
      break;
    case 'multiply':
      result = blendMultiply(base, overlay, opacity);
      break;
    case 'normal':
    default:
      result = blendNormal(base, overlay, opacity);
      break;
  }

  return rgbToHex(result);
}

export function computeLayerColor(
  layer: EffectLayer,
  ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>,
  stack: Pick<EffectStack, 'seedTimestamp' | 'matrix'>
): string {
  const presetCtx: PresetContext = {
    row: ctx.row,
    col: ctx.col,
    timeMs: ctx.timeMs,
    seed: stack.seedTimestamp,
    matrixRows: stack.matrix.rows,
    matrixCols: stack.matrix.cols,
    palette: layer.params?.palette,
    audio:
      layer.presetId === 'audio'
        ? ctx.audio
        : undefined,
  };

  return computePresetColor(layer.presetId, presetCtx);
}

export function computeEffectStackColor(
  stack: EffectStack,
  ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>
): string {
  if (stack.layers.length === 0) {
    return '#111111';
  }

  let result: string | null = null;

  for (const layer of stack.layers) {
    const layerColor = computeLayerColor(layer, ctx, stack);
    result = compositeColors(result, layerColor, layer.blend, layer.opacity);
  }

  return result ?? '#111111';
}
