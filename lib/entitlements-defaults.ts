import type { PlanEntitlements } from '@/lib/glow/types';

export const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  maxDevices: 10,
  adsEnabled: true,
  availablePresets: ['solid', 'flash', 'pulse', 'audio'],
  audioReactive: true,
  matrixMode: true,
  advancedMatrix: false,
  customGridSize: false,
  maxGridRows: 5,
  maxGridCols: 5,
  maxRoomDurationMinutes: 60,
  manualFallbackMode: true,
  priorityReconnectWindowSeconds: 60,
  // v2 — Visuals surface (safe defaults = branded-only)
  visualsSurface: true,
  availableVisualArts: ['glow-branded'],
  maxRigs: 1,
  effectLayering: false,
  maxPatternSequences: 1,
  audienceReactions: true,
  customMediaUpload: false,
  gifBroadcast: false,
  sequencedText: false,
  deviceFlashControl: false,
  webrtcLiveCall: false,
  maxLiveCallDevices: 0,
};
