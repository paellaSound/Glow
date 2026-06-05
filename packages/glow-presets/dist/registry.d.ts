import type { PresetDefinition, PresetId } from './types.js';
export declare const PRESET_REGISTRY: Record<PresetId, PresetDefinition>;
export declare function getPreset(id: string): PresetDefinition | undefined;
export declare function listPresets(): PresetDefinition[];
export declare function isValidPresetId(id: string): id is PresetId;
export declare function presetsForPlan(planCode: string): PresetId[];
export declare const PRESET_LABELS: Record<PresetId, string>;
