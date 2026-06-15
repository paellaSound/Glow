import type { PlanEntitlements } from '@/lib/glow/types';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import {
  formatPlanPrice,
  formatDeviceCap,
  getPlanMeta,
  UNLIMITED_DEVICES_THRESHOLD,
  type PlanCode,
} from './plan-meta';

// PRICING MODEL: every plan ships the full product. You only pay for two things:
//   1. Crowd size  — how many phones can join (the real server cost)
//   2. Your brand  — your logo on stage, your QR, no Glow watermark
// The card copy below makes that explicit: "Crowd size" and "Your brand" are the
// differentiators, and "Every feature included" reassures that nothing is locked.

export type BillingSectionKey = 'crowd' | 'brand' | 'included';

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
  crowd: 'Crowd size — what you pay for',
  brand: 'Your brand',
  included: 'Every feature included',
};

function devicesLabel(maxDevices: number): string {
  return maxDevices >= UNLIMITED_DEVICES_THRESHOLD
    ? 'Unlimited phones'
    : `Up to ${maxDevices} phones`;
}

function matrixLabel(cells: number, rows: number, cols: number): string {
  if (cells >= UNLIMITED_DEVICES_THRESHOLD) return 'Matrix grids with no practical limit';
  return `Up to ${cells} matrix cells (grid ${rows}×${cols})`;
}

function buildSections(ents: PlanEntitlements): BillingSection[] {
  // 1. Crowd size — the thing that scales, and the thing you pay for
  const crowdItems: string[] = [
    devicesLabel(ents.maxDevices),
    matrixLabel(ents.maxMatrixCells, ents.maxGridRows, ents.maxGridCols),
    ents.adsEnabled ? 'House ad on join' : 'No ads',
  ];
  if (ents.requiresCoverageAck) {
    crowdItems.push('Massive crowds (best with solid venue coverage)');
  }

  // 2. Your brand — the second paid axis
  const brandItems: string[] = [
    ents.removeWatermark ? 'No Glow watermark on stage' : `${GLOW_BRAND_NAME} watermark on stage`,
    ents.customRigLogo ? 'Your logo on the projector' : `${GLOW_BRAND_NAME} logo on the projector`,
    ents.customQrBranding ? 'Your QR + social links' : `${GLOW_BRAND_NAME} join QR`,
  ];

  // 3. Everything included — identical on every plan (nothing is locked behind a tier)
  const includedItems: string[] = [
    'Stage visuals: YouTube, 3D & shaders',
    'Every light preset + audio-reactive FX',
    'Effect layering, sequences & text',
    'Image uploads + full GIF search',
    'Phone flash / torch control',
    'Audience reactions & live polls',
    'Live camera mosaic (WebRTC)',
  ];

  return [
    { key: 'crowd', title: SECTION_LABELS.crowd, items: crowdItems },
    { key: 'brand', title: SECTION_LABELS.brand, items: brandItems },
    { key: 'included', title: SECTION_LABELS.included, items: includedItems },
  ];
}

const BRANDING_NOTES: Record<PlanCode, string> = {
  free: `Run the whole product free — ${GLOW_BRAND_NAME} branded, up to 15 phones.`,
  plus_25: 'More phones and zero ads — the easiest way to grow the floor.',
  plus_50: `Your logo on stage, your QR, no ${GLOW_BRAND_NAME} watermark — and room for 300.`,
  pro: 'Unlimited phones for festivals, tours and big rooms.',
};

const TAGLINES: Record<PlanCode, string> = {
  free: 'The full show, on us',
  plus_25: 'Scale up your night',
  plus_50: 'Make the stage yours',
  pro: 'No limits',
};

const CTAS: Record<PlanCode, string> = {
  free: 'Current plan',
  plus_25: 'Get Party',
  plus_50: 'Get Venue',
  pro: 'Go Pro',
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
    sections: buildSections(ents),
    priceLabel:
      planCode === 'free' ? 'Free' : formatPlanPrice(meta?.priceCents ?? 0),
  };
}

// Re-export for consumers that display the device cap.
export { formatDeviceCap };
