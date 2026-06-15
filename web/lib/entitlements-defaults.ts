import type { PlanEntitlements } from '@/lib/glow/types';

// Fallback = plan `free` del modelo actual: todas las features desbloqueadas,
// solo limitado por escala (15 devices) y branding (marca Glow). Ver web/lib/entitlements.ts.
export const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  maxDevices: 15,
  maxMatrixCells: 15,
  adsEnabled: true,
  availablePresets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'],
  audioReactive: true,
  matrixMode: true,
  advancedMatrix: true,
  customGridSize: true,
  maxGridRows: 5,
  maxGridCols: 5,
  maxRoomDurationMinutes: 720,
  manualFallbackMode: true,
  priorityReconnectWindowSeconds: 180,
  customRigLogo: false,
  customQrBranding: false,
  gifSearchMode: 'full',
  // v2 — Visuals surface
  visualsSurface: true,
  availableVisualArts: ['audio-shader'],
  maxRigs: 50,
  effectLayering: true,
  maxPatternSequences: 50,
  audienceReactions: true,
  customMediaUpload: true,
  gifBroadcast: true,
  sequencedText: true,
  deviceFlashControl: true,
  webrtcLiveCall: true,
  maxLiveCallDevices: 2,
  visualsEmitSlotsPerMode: 999,
  liveCallTestModeOnly: false,
  pollProductionEnabled: true,
  // Branding (eje de pago) + confirmación de cobertura (plan ∞)
  removeWatermark: false,
  requiresCoverageAck: false,
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
