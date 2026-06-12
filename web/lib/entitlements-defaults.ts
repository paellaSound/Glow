import type { PlanEntitlements } from '@/lib/glow/types';

export const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  maxDevices: 10,
  maxMatrixCells: 10,
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
  customRigLogo: false,
  customQrBranding: false,
  gifSearchMode: 'featured_page1',
  // v2 — Visuals surface
  visualsSurface: true,
  availableVisualArts: ['audio-shader'],
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

/** Merge room snapshot entitlements with live team entitlements (team wins). */
export function mergeEntitlementsForUi(
  roomEntitlements: PlanEntitlements | null | undefined,
  teamEntitlements: PlanEntitlements | null | undefined
): PlanEntitlements {
  return {
    ...DEFAULT_ENTITLEMENTS,
    ...roomEntitlements,
    ...teamEntitlements,
  };
}
