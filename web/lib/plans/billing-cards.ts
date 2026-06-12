import type { PlanEntitlements } from '@/lib/glow/types';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import { formatPlanPrice, getPlanMeta, type PlanCode } from './plan-meta';

export type BillingSectionKey = 'stage' | 'floor' | 'crowd' | 'scale';

export type BillingSection = {
  key: BillingSectionKey;
  title: string;
  items: string[];
};

export type BillingPlanPresentation = {
  planCode: PlanCode;
  marketingName: string;
  tagline: string;
  ctaLabel: string;
  recommended?: boolean;
  brandingNote: string;
  sections: BillingSection[];
  priceLabel: string;
};

const SECTION_LABELS: Record<BillingSectionKey, string> = {
  stage: 'Stage (projector)',
  floor: 'Floor (phones)',
  crowd: 'Crowd',
  scale: 'Scale',
};

function matrixLabel(cells: number, rows: number, cols: number): string {
  if (cells >= 999) return 'Up to 999 matrix cells';
  return `Up to ${cells} matrix cells (max ${rows}×${cols} grid)`;
}

function buildSections(planCode: PlanCode, ents: PlanEntitlements): BillingSection[] {
  const devices =
    ents.maxDevices >= 999 ? 'Unlimited devices' : `Up to ${ents.maxDevices} devices`;
  const matrix = matrixLabel(ents.maxMatrixCells, ents.maxGridRows, ents.maxGridCols);
  const session = `${Math.round(ents.maxRoomDurationMinutes / 60)} h sessions`;
  const ads = ents.adsEnabled ? 'House ads on join' : 'Ad-free';

  const emitLabel =
    ents.visualsEmitSlotsPerMode >= 999
      ? 'Unlimited surface mode emits'
      : `${ents.visualsEmitSlotsPerMode} surface emit per mode`;

  const stageItems: string[] = [
    ents.visualsSurface ? 'Visuals surface + desk preview' : 'Visuals preview in desk',
    `YouTube & 3D — preview all modes, ${emitLabel}`,
    ents.customRigLogo ? 'Your logo on stage' : `${GLOW_BRAND_NAME} logo on stage`,
  ];

  const floorItems: string[] = [
    `${ents.availablePresets.length} light presets`,
    ents.effectLayering ? 'Multi-effect layering' : 'Single-effect sequences',
    ents.customMediaUpload ? 'Custom image upload' : 'Preset media only',
    ents.gifSearchMode === 'full' ? 'Full GIF search & broadcast' : 'Featured GIFs (page 1)',
    ents.sequencedText ? 'Sequenced text overlays' : 'Basic text taste',
    ents.deviceFlashControl ? 'Device flash / torch' : 'Flash preview only',
  ];

  const crowdItems: string[] = [
    ents.audienceReactions ? 'Audience reactions' : 'Reactions',
    ents.customQrBranding ? 'Your QR + social links' : `${GLOW_BRAND_NAME} QR branding`,
    ents.webrtcLiveCall ? 'Live camera mosaic on stage' : 'Live call test in desk',
    'Raffle & polls (scale with devices)',
  ];

  const scaleItems = [devices, matrix, session, ads];

  const sections: BillingSection[] = [
    { key: 'stage', title: SECTION_LABELS.stage, items: stageItems },
    { key: 'floor', title: SECTION_LABELS.floor, items: floorItems },
    { key: 'crowd', title: SECTION_LABELS.crowd, items: crowdItems },
    { key: 'scale', title: SECTION_LABELS.scale, items: scaleItems },
  ];

  if (planCode === 'plus_50') {
    sections[2].items.push('Song requests (coming soon)');
  }

  return sections;
}

const BRANDING_NOTES: Record<PlanCode, string> = {
  free: `${GLOW_BRAND_NAME} logo & QR — great for discovery`,
  plus_25: `${GLOW_BRAND_NAME} branding on logo / QR`,
  plus_50: 'Your logo on stage + custom QR socials',
  pro: 'Full white-label + live production tools',
};

const TAGLINES: Record<PlanCode, string> = {
  free: 'Try the full show',
  plus_25: 'Scale your party now',
  plus_50: 'Your brand on stage',
  pro: 'Live production & events',
};

const CTAS: Record<PlanCode, string> = {
  free: 'Current plan',
  plus_25: 'Scale your party',
  plus_50: 'Your brand on stage',
  pro: 'Live production',
};

export function buildBillingPresentation(
  planCode: PlanCode,
  ents: PlanEntitlements
): BillingPlanPresentation {
  const meta = planCode === 'free' ? null : getPlanMeta(planCode);
  return {
    planCode,
    marketingName: meta?.marketingName ?? 'Free',
    tagline: TAGLINES[planCode],
    ctaLabel: CTAS[planCode],
    recommended: planCode === 'plus_50',
    brandingNote: BRANDING_NOTES[planCode],
    sections: buildSections(planCode, ents),
    priceLabel:
      planCode === 'free' ? 'Free' : formatPlanPrice(meta?.priceCents ?? 0),
  };
}
