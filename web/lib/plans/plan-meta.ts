import type { PlanEntitlements } from '@/lib/glow/types';

export type PlanCode = 'free' | 'plus_25' | 'plus_50' | 'pro';

export type GateFeature =
  | 'max_devices'
  | 'matrix_too_large'
  | 'customMediaUpload'
  | 'gifBroadcast'
  | 'effect_layering'
  | 'sequencedText'
  | 'deviceFlashControl'
  | 'webrtcLiveCall'
  | 'visualsSurface'
  | 'customRigLogo'
  | 'customQrBranding'
  | 'gifSearchFull'
  | 'visualsEmit';

export type PlanGateState = 'allowed' | 'limited' | 'preview' | 'blocked';

export type PlanMeta = {
  planCode: PlanCode;
  marketingName: string;
  priceCents: number;
  deviceCap: number;
  matrixCellCap: number;
  ctaLabel: string;
};

export const PLAN_META: Record<Exclude<PlanCode, 'free'>, PlanMeta> = {
  plus_25: {
    planCode: 'plus_25',
    marketingName: 'Party',
    priceCents: 299,
    deviceCap: 25,
    matrixCellCap: 25,
    ctaLabel: 'Activate Party',
  },
  plus_50: {
    planCode: 'plus_50',
    marketingName: 'Venue',
    priceCents: 500,
    deviceCap: 50,
    matrixCellCap: 50,
    ctaLabel: 'Activate Venue',
  },
  pro: {
    planCode: 'pro',
    marketingName: 'Pro',
    priceCents: 2500,
    deviceCap: 999,
    matrixCellCap: 999,
    ctaLabel: 'Activate Pro',
  },
};

/** Minimum paid plan that unlocks each gated feature. */
export const FEATURE_MIN_PLAN: Record<GateFeature, Exclude<PlanCode, 'free'>> = {
  max_devices: 'plus_25',
  matrix_too_large: 'plus_25',
  sequencedText: 'plus_25',
  deviceFlashControl: 'plus_25',
  visualsSurface: 'plus_25',
  customMediaUpload: 'plus_50',
  gifBroadcast: 'plus_50',
  effect_layering: 'plus_50',
  webrtcLiveCall: 'pro',
  customRigLogo: 'plus_50',
  customQrBranding: 'plus_50',
  gifSearchFull: 'plus_50',
  visualsEmit: 'plus_50',
};

const ENTITLEMENT_KEY: Record<GateFeature, keyof PlanEntitlements | null> = {
  max_devices: 'maxDevices',
  matrix_too_large: 'maxMatrixCells',
  customMediaUpload: 'customMediaUpload',
  gifBroadcast: 'gifBroadcast',
  effect_layering: 'effectLayering',
  sequencedText: 'sequencedText',
  deviceFlashControl: 'deviceFlashControl',
  webrtcLiveCall: 'webrtcLiveCall',
  visualsSurface: 'visualsSurface',
  customRigLogo: 'customRigLogo',
  customQrBranding: 'customQrBranding',
  gifSearchFull: 'gifSearchMode',
  visualsEmit: 'visualsEmitSlotsPerMode',
};

export function formatPlanPrice(priceCents: number): string {
  if (priceCents === 0) return 'Free';
  const euros = priceCents / 100;
  const formatted = Number.isInteger(euros) ? euros.toFixed(0) : euros.toFixed(2);
  return `€${formatted}/mo`;
}

export function getPlanMeta(planCode: PlanCode): PlanMeta | null {
  if (planCode === 'free') return null;
  return PLAN_META[planCode];
}

export function getRequiredPlanForFeature(feature: GateFeature): Exclude<PlanCode, 'free'> {
  return FEATURE_MIN_PLAN[feature];
}

export function isFeatureAllowed(
  feature: GateFeature,
  entitlements: PlanEntitlements,
  context?: { deviceCount?: number; matrixCells?: number }
): boolean {
  switch (feature) {
    case 'max_devices':
      return (context?.deviceCount ?? 0) < entitlements.maxDevices;
    case 'matrix_too_large':
      return (context?.matrixCells ?? 0) <= entitlements.maxMatrixCells;
    case 'gifSearchFull':
      return entitlements.gifSearchMode === 'full';
    case 'visualsEmit':
      return (entitlements.visualsEmitSlotsPerMode ?? 999) >= 999;
    default: {
      const key = ENTITLEMENT_KEY[feature];
      if (!key) return true;
      return Boolean(entitlements[key]);
    }
  }
}

export function deriveGateState(
  feature: GateFeature,
  entitlements: PlanEntitlements,
  context?: { deviceCount?: number; matrixCells?: number }
): PlanGateState {
  if (isFeatureAllowed(feature, entitlements, context)) return 'allowed';
  return 'blocked';
}

export function buildLimitTitle(
  feature: GateFeature,
  context?: { deviceCount?: number; matrixCells?: number; rows?: number; cols?: number }
): string {
  switch (feature) {
    case 'max_devices':
      return context?.deviceCount
        ? `You need ${context.deviceCount + 1} devices for this party`
        : "You've reached your device limit";
    case 'matrix_too_large':
      if (context?.rows && context?.cols) {
        return `Your ${context.rows}×${context.cols} grid needs a bigger plan`;
      }
      return 'This grid size exceeds your plan limit';
    case 'customMediaUpload':
      return 'Custom image uploads require Venue';
    case 'gifBroadcast':
      return 'GIF broadcast requires Venue';
    case 'sequencedText':
      return 'Sequenced text overlays require Party';
    case 'deviceFlashControl':
      return 'Device flash control requires Party';
    case 'effect_layering':
      return 'Multi-effect layering requires Venue';
    case 'webrtcLiveCall':
      return 'Live call mosaic requires Pro';
    case 'visualsSurface':
      return 'Visuals surface requires Party';
    case 'customRigLogo':
      return 'Custom rig logo requires Venue';
    case 'customQrBranding':
      return 'Custom QR & socials require Venue';
    case 'gifSearchFull':
      return 'Full GIF search requires Venue';
    case 'visualsEmit':
      return 'More surface emits require Venue';
    default:
      return 'Upgrade to unlock this feature';
  }
}

export function buildLimitBody(feature: GateFeature, planCode: Exclude<PlanCode, 'free'>): string {
  const meta = PLAN_META[planCode];
  const price = formatPlanPrice(meta.priceCents);

  switch (feature) {
    case 'max_devices':
      return `${meta.marketingName} supports up to ${meta.deviceCap} devices — ${price}`;
    case 'matrix_too_large':
      return `${meta.marketingName} supports up to ${meta.matrixCellCap} matrix cells — ${price}`;
    case 'customMediaUpload':
    case 'gifBroadcast':
    case 'effect_layering':
      return `${meta.marketingName} unlocks full media and layering — ${price}`;
    case 'sequencedText':
    case 'deviceFlashControl':
    case 'visualsSurface':
      return `${meta.marketingName} unlocks this control — ${price}`;
    case 'webrtcLiveCall':
      return `${meta.marketingName} unlocks live camera mosaic — ${price}`;
    case 'customRigLogo':
    case 'customQrBranding':
      return `${meta.marketingName} puts your brand on stage & QR — ${price}`;
    case 'gifSearchFull':
      return `${meta.marketingName} unlocks full GIF search — ${price}`;
    case 'visualsEmit':
      return `${meta.marketingName} unlocks unlimited surface emits — ${price}`;
    default:
      return `${meta.marketingName} — ${price}`;
  }
}
