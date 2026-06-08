export type {
  AudioFeatures,
  AudioSource,
  DistributionEffect,
  EffectBlendMode,
  EffectDistribution,
  EffectLayer,
  EffectStack,
  PresetId,
  PresetParams,
  VisualAudioFeaturesEvent,
  VisualPresetEvent,
} from 'glow-presets';

export type PlanEntitlements = {
  maxDevices: number;
  adsEnabled: boolean;
  availablePresets: string[];
  audioReactive: boolean;
  matrixMode: boolean;
  advancedMatrix: boolean;
  customGridSize: boolean;
  maxGridRows: number;
  maxGridCols: number;
  maxRoomDurationMinutes: number;
  manualFallbackMode: boolean;
  priorityReconnectWindowSeconds: number;
  // v2 — Visuals surface
  visualsSurface: boolean;
  availableVisualArts: string[];
  maxRigs: number;
  effectLayering: boolean;
  maxPatternSequences: number;
};

export type RoomStatePayload = {
  code: string;
  sessionId: string;
  status: 'active' | 'orchestrator_missing' | 'closing';
  mode: 'live' | 'fallback';
  matrix: {
    rows: number;
    cols: number;
    occupied: Array<{
      row: number;
      col: number;
      label: string;
      publicId: string;
      nickname?: string;
      latencyMs?: number;
      status: string;
    }>;
  };
  devices: Array<{
    publicId: string;
    nickname?: string;
    row?: number;
    col?: number;
    label?: string;
    joinedAt: number;
    lastSeenAt: number;
    latencyMs?: number;
    status: 'online' | 'stale' | 'reconnecting';
  }>;
  entitlements: PlanEntitlements;
  adsEnabled: boolean;
  serverTime: number;
};

export type VisualColorEvent = {
  colorHex: string;
  targetTimestamp: number;
  row?: number;
  col?: number;
};

export type FallbackModeEvent = {
  enabled: boolean;
  seedTimestamp: number;
  roomCode: string;
};
