export type PlanTier = 'free' | 'plus_25' | 'plus_50' | 'pro';
export type PresetCategory = 'basic' | 'motion' | 'advanced';
export type AudioSource = 'local' | 'orchestrator';
export type AudioFeatures = {
    bass: number;
    mid: number;
    treble: number;
    energy: number;
};
export type PresetContext = {
    row: number;
    col: number;
    timeMs: number;
    seed: number;
    matrixRows: number;
    matrixCols: number;
    audio?: AudioFeatures;
};
export type PresetParams = {
    audioSource?: AudioSource;
};
export type VisualPresetEvent = {
    presetId: string;
    seedTimestamp: number;
    targetTimestamp: number;
    matrix: {
        rows: number;
        cols: number;
    };
    params?: PresetParams;
};
export type VisualAudioFeaturesEvent = {
    features: AudioFeatures;
    timestamp: number;
};
export type PresetId = 'solid' | 'flash' | 'pulse' | 'wave' | 'rainbow' | 'diagonal' | 'strobe' | 'audio';
export type PresetDefinition = {
    id: PresetId;
    label: string;
    description?: string;
    category: PresetCategory;
    minTier: PlanTier;
    requiresAudioReactive?: boolean;
    render: (ctx: PresetContext) => string;
};
