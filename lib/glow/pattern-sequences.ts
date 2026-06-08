import { isValidPresetId, type PresetId, type PresetParams } from 'glow-presets';
import { randomId } from '@/lib/utils';

export type PatternSequenceEffect = {
  id: string;
  presetId: PresetId;
  params?: PresetParams;
  active: boolean;
  weight: number;
};

export type PatternSequenceMedia = {
  kind: 'text' | 'gif';
  text?: string;
  mode?: 'marquee' | 'word_by_word' | 'spread_grid';
  speed?: number;
  colorHex?: string;
  loop?: boolean;
  fontSize?: number;
  gifSlug?: string;
  gifUrl?: string;
  gifWidth?: number;
  gifHeight?: number;
  target?: any; // DeviceTarget
  active: boolean;
};

export type PatternSequenceRecord = {
  id: string;
  name: string;
  palette: string[];
  effects: PatternSequenceEffect[];
  media?: PatternSequenceMedia | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PatternSequenceDraft = {
  name: string;
  palette: string[];
  effects: PatternSequenceEffect[];
  media?: PatternSequenceMedia | null;
  isDefault?: boolean;
};

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function validatePalette(palette: unknown): palette is string[] {
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > 12) {
    return false;
  }
  return palette.every((color) => typeof color === 'string' && HEX_COLOR_RE.test(color));
}

export function getActiveEffects(effects: PatternSequenceEffect[]): PatternSequenceEffect[] {
  return effects.filter((effect) => effect.active);
}

export function normalizeWeights(effects: PatternSequenceEffect[]): PatternSequenceEffect[] {
  const active = getActiveEffects(effects);
  if (active.length === 0) return effects;

  const evenWeight = Math.floor(100 / active.length);
  let remainder = 100 - evenWeight * active.length;

  return effects.map((effect) => {
    if (!effect.active) {
      return { ...effect, weight: 0 };
    }
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { ...effect, weight: evenWeight + extra };
  });
}

export function validateEffects(
  effects: unknown,
  allowMultiEffect: boolean
): effects is PatternSequenceEffect[] {
  if (!Array.isArray(effects) || effects.length === 0) return false;

  const parsed = effects as PatternSequenceEffect[];
  const active = parsed.filter((e) => e.active);

  if (active.length === 0) return false;
  if (!allowMultiEffect && active.length > 1) return false;

  for (const effect of active) {
    if (!isValidPresetId(effect.presetId)) return false;
    if (typeof effect.weight !== 'number' || effect.weight <= 0) return false;
  }

  const sum = active.reduce((acc, e) => acc + e.weight, 0);
  return Math.abs(sum - 100) < 0.01;
}

export function toDistributionEffects(
  effects: PatternSequenceEffect[],
  palette: string[]
): Array<{ presetId: PresetId; params?: PresetParams; weight: number }> {
  return getActiveEffects(effects).map((effect) => ({
    presetId: effect.presetId,
    weight: effect.weight,
    params: {
      ...effect.params,
      palette,
      ...(effect.presetId === 'audio' ? { audioSource: effect.params?.audioSource ?? 'local' } : {}),
    },
  }));
}

export function createEmptyEffect(presetId: PresetId = 'pulse'): PatternSequenceEffect {
  return {
    id: randomId(),
    presetId,
    active: true,
    weight: 100,
  };
}

export function createDefaultDraft(palette: string[] = ['#FF0055', '#00FFCC']): PatternSequenceDraft {
  return {
    name: 'Untitled Sequence',
    palette,
    effects: [createEmptyEffect('pulse')],
    isDefault: false,
  };
}

export async function fetchPatternSequences(): Promise<PatternSequenceRecord[]> {
  const response = await fetch('/api/pattern-sequences');
  const data = await response.json();
  if (!response.ok || !Array.isArray(data)) {
    return [];
  }
  return data as PatternSequenceRecord[];
}
