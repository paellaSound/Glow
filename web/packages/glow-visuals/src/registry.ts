import { mountAudioShader } from './arts/audio-shader.js';
import type { PlanTier, VisualArtDefinition, VisualArtId } from './types.js';

export const VISUAL_ART_REGISTRY: Record<VisualArtId, VisualArtDefinition> = {
  'audio-shader': {
    id: 'audio-shader',
    label: 'Audio Shader',
    description: 'Music-reactive WebGL shader driven by bass and treble',
    minTier: 'free',
    mount: mountAudioShader,
  },
};

/** Default art for new rooms/rigs and fallback for removed/unknown art ids. */
export const DEFAULT_VISUAL_ART_ID: VisualArtId = 'audio-shader';

const TIER_ORDER: PlanTier[] = ['free', 'plus_25', 'plus_50', 'pro'];

function normalizePlanTier(planCode: string): PlanTier {
  if (
    planCode === 'free' ||
    planCode === 'plus_25' ||
    planCode === 'plus_50' ||
    planCode === 'pro'
  ) {
    return planCode;
  }
  return 'free';
}

/** Return all art IDs accessible at `planCode`. */
export function visualArtsForPlan(planCode: string): VisualArtId[] {
  const tier = normalizePlanTier(planCode);
  const tierIndex = TIER_ORDER.indexOf(tier);
  return (Object.values(VISUAL_ART_REGISTRY) as VisualArtDefinition[])
    .filter((art) => TIER_ORDER.indexOf(art.minTier) <= tierIndex)
    .map((art) => art.id);
}

export function getVisualArt(id: string): VisualArtDefinition | undefined {
  return isValidVisualArtId(id) ? VISUAL_ART_REGISTRY[id] : undefined;
}

export function isValidVisualArtId(id: string): id is VisualArtId {
  return id in VISUAL_ART_REGISTRY;
}

export const VISUAL_ART_LABELS: Record<VisualArtId, string> = Object.fromEntries(
  (Object.values(VISUAL_ART_REGISTRY) as VisualArtDefinition[]).map((a) => [a.id, a.label]),
) as Record<VisualArtId, string>;
