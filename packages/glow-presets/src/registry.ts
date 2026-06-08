import { renderAudio } from './render/audio.js';
import { renderDiagonal } from './render/diagonal.js';
import { renderFlash } from './render/flash.js';
import { renderPulse } from './render/pulse.js';
import { renderRainbow } from './render/rainbow.js';
import { renderSolid } from './render/solid.js';
import { renderStrobe } from './render/strobe.js';
import { renderWave } from './render/wave.js';
import type { PlanTier, PresetDefinition, PresetId } from './types.js';

export const PRESET_REGISTRY: Record<PresetId, PresetDefinition> = {
  solid: {
    id: 'solid',
    label: 'Solid',
    category: 'basic',
    minTier: 'free',
    render: renderSolid,
  },
  flash: {
    id: 'flash',
    label: 'Flash',
    category: 'basic',
    minTier: 'free',
    render: renderFlash,
  },
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    category: 'basic',
    minTier: 'free',
    render: renderPulse,
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    category: 'motion',
    minTier: 'plus_25',
    render: renderWave,
  },
  rainbow: {
    id: 'rainbow',
    label: 'Rainbow',
    category: 'motion',
    minTier: 'plus_25',
    render: renderRainbow,
  },
  diagonal: {
    id: 'diagonal',
    label: 'Diagonal',
    category: 'advanced',
    minTier: 'plus_50',
    render: renderDiagonal,
  },
  strobe: {
    id: 'strobe',
    label: 'Strobe',
    category: 'advanced',
    minTier: 'pro',
    render: renderStrobe,
  },
  audio: {
    id: 'audio',
    label: 'Audio',
    description: 'Music-reactive colors from microphone input',
    category: 'advanced',
    minTier: 'free',
    requiresAudioReactive: true,
    render: renderAudio,
  },
};

const TIER_ORDER: PlanTier[] = ['free', 'plus_25', 'plus_50', 'pro'];

export function getPreset(id: string): PresetDefinition | undefined {
  if (!isValidPresetId(id)) {
    return undefined;
  }
  return PRESET_REGISTRY[id];
}

export function listPresets(): PresetDefinition[] {
  return Object.values(PRESET_REGISTRY);
}

export function isValidPresetId(id: string): id is PresetId {
  return id in PRESET_REGISTRY;
}

export function presetsForPlan(planCode: string): PresetId[] {
  const tier = normalizePlanTier(planCode);
  const tierIndex = TIER_ORDER.indexOf(tier);
  if (tierIndex === -1) {
    return ['solid', 'flash', 'pulse'];
  }

  return listPresets()
    .filter((preset) => TIER_ORDER.indexOf(preset.minTier) <= tierIndex)
    .map((preset) => preset.id);
}

function normalizePlanTier(planCode: string): PlanTier {
  if (planCode === 'free' || planCode === 'plus_25' || planCode === 'plus_50' || planCode === 'pro') {
    return planCode;
  }
  return 'free';
}

export const PRESET_LABELS: Record<PresetId, string> = Object.fromEntries(
  listPresets().map((preset) => [preset.id, preset.label])
) as Record<PresetId, string>;
