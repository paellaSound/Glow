import { mountGlowBranded } from './arts/glow-branded.js';
import { mountPulseGrid } from './arts/pulse-grid.js';
import { mountAudioShader } from './arts/audio-shader.js';
export const VISUAL_ART_REGISTRY = {
    'glow-branded': {
        id: 'glow-branded',
        label: 'Glow Branded',
        description: 'Animated branded splash with room code and join link — always available',
        minTier: 'free',
        mount: mountGlowBranded,
    },
    'pulse-grid': {
        id: 'pulse-grid',
        label: 'Pulse Grid',
        description: 'Palette-coloured grid that waves with the music',
        minTier: 'plus_25',
        mount: mountPulseGrid,
    },
    'audio-shader': {
        id: 'audio-shader',
        label: 'Audio Shader',
        description: 'Music-reactive WebGL shader driven by bass and treble',
        minTier: 'plus_25',
        mount: mountAudioShader,
    },
};
const TIER_ORDER = ['free', 'plus_25', 'plus_50', 'pro'];
function normalizePlanTier(planCode) {
    if (planCode === 'free' ||
        planCode === 'plus_25' ||
        planCode === 'plus_50' ||
        planCode === 'pro') {
        return planCode;
    }
    return 'free';
}
/** Return all art IDs accessible at `planCode`. */
export function visualArtsForPlan(planCode) {
    const tier = normalizePlanTier(planCode);
    const tierIndex = TIER_ORDER.indexOf(tier);
    return Object.values(VISUAL_ART_REGISTRY)
        .filter((art) => TIER_ORDER.indexOf(art.minTier) <= tierIndex)
        .map((art) => art.id);
}
export function getVisualArt(id) {
    return isValidVisualArtId(id) ? VISUAL_ART_REGISTRY[id] : undefined;
}
export function isValidVisualArtId(id) {
    return id in VISUAL_ART_REGISTRY;
}
export const VISUAL_ART_LABELS = Object.fromEntries(Object.values(VISUAL_ART_REGISTRY).map((a) => [a.id, a.label]));
