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
  audienceReactions: boolean;
  customMediaUpload: boolean;
  gifBroadcast: boolean;
  sequencedText: boolean;
  deviceFlashControl: boolean;
  webrtcLiveCall: boolean;
  maxLiveCallDevices: number;
};

// ── WebRTC live-call ─────────────────────────────────────────────────────────

export type WebrtcSignal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit };

export type LiveTile = {
  publicId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export type LiveCallPublisherStatus = 'requested' | 'live' | 'declined';

export type LiveCallStatePayload = {
  callId: string;
  active: boolean;
  publishers: Array<{ publicId: string; status: LiveCallPublisherStatus }>;
  tiles: LiveTile[];
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
    torchCapability?: TorchCapability;
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

export type TorchCapability = {
  supported: boolean;
  enabled: boolean;
};

export type TorchCommand =
  | { action: 'off' }
  | { action: 'hold'; mode: 'pulse' }
  | { action: 'hold'; mode: 'strobe'; onMs: number; offMs: number }
  | { action: 'on' }
  | { action: 'pulse'; durationMs: number }
  | { action: 'pattern'; onMs: number; offMs: number; cycles: number };

export type DeviceTorchEvent = {
  command: TorchCommand;
  targetTimestamp: number;
};

export type DeviceTarget =
  | { kind: 'all' }
  | { kind: 'devices'; publicIds: string[] }
  | { kind: 'matrix_range'; fromRow: number; toRow: number; fromCol: number; toCol: number }
  | { kind: 'fraction'; from: number; to: number };

export type SequencedTextPayload = {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  speed: number;        // chars/sec or words/sec
  colorHex?: string;    // defaults to palette
  loop: boolean;
};

export type GifBroadcastPayload = {
  slug: string;
  url: string;
  width: number;
  height: number;
};

export type VisualMediaEvent = {
  kind: 'image' | 'gif' | 'text' | 'clear';
  url?: string;
  text?: string;
  mode?: 'marquee' | 'word_by_word' | 'spread_grid';
  speed?: number;
  colorHex?: string;
  loop?: boolean;
  fontSize?: number;
  fit?: 'cover' | 'contain';
  durationMs?: number;
  timestamp: number;
};
