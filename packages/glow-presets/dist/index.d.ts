export { computePresetColor } from './compute.js';
export { computeEffectStackColor } from './compositor.js';
export { compositeColors, computeLayerColor, hexToRgb, rgbToHex, } from './compositor.js';
export { computeFallbackColor, FALLBACK_PRESET_ID } from './fallback.js';
export { getPreset, isValidPresetId, listPresets, PRESET_LABELS, PRESET_REGISTRY, presetsForPlan, } from './registry.js';
export type { AudioFeatures, AudioSource, EffectBlendMode, EffectLayer, EffectStack, PlanTier, PresetCategory, PresetContext, PresetDefinition, PresetId, PresetParams, VisualAudioFeaturesEvent, VisualPresetEvent, } from './types.js';
export { isValidHexColor } from './utils/color.js';
export { computeDistributionColor, distributionBucket, pickEffectForDevice, previewDeviceKey, validateDistributionWeights, } from './distribution.js';
export type { DistributionEffect, EffectDistribution } from './distribution.js';
