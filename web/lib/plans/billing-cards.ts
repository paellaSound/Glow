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
//
// CARD UX: keep cards scannable. The card shows the headline (crowd size) + the
// DELTA over the previous plan (what's new). The full feature detail lives behind
// an "i" popover (`detailSections`) so the card stays low-noise.

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
  priceLabel: string;
  /** Big scannable headline — the crowd size. */
  headline: string;
  /** "Everything in <prev>, plus:" — null for Free (the base plan). */
  deltaIntro: string | null;
  /** Short list of what THIS plan adds over the previous one. */
  deltaItems: string[];
  /** Full feature detail, shown inside the "i" popover. */
  detailSections: BillingSection[];
};

const SECTION_LABELS: Record<BillingSectionKey, string> = {
  crowd: 'Crowd size',
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

/** Full detail for the "i" popover — identical structure across plans. */
function buildDetailSections(ents: PlanEntitlements): BillingSection[] {
  const crowdItems: string[] = [
    devicesLabel(ents.maxDevices),
    matrixLabel(ents.maxMatrixCells, ents.maxGridRows, ents.maxGridCols),
    ents.adsEnabled ? 'House ad on join' : 'No ads',
  ];
  if (ents.requiresCoverageAck) {
    crowdItems.push('Massive crowds (best with solid venue coverage)');
  }

  const brandItems: string[] = [
    ents.removeWatermark ? 'No Glow watermark on stage' : `${GLOW_BRAND_NAME} watermark on stage`,
    ents.customRigLogo ? 'Your logo on the projector' : `${GLOW_BRAND_NAME} logo on the projector`,
    ents.customQrBranding ? 'Your QR + social links' : `${GLOW_BRAND_NAME} join QR`,
  ];

  const includedItems: string[] = [
    'Stage visuals: YouTube, 3D & shaders',
    'Every light preset + audio-reactive FX',
    'Effect layering, sequences & text',
    'Image uploads + full GIF search',
    'Device flash / torch control',
    'Audience reactions & live polls',
    'Live camera mosaic (WebRTC)',
  ];

  return [
    { key: 'crowd', title: SECTION_LABELS.crowd, items: crowdItems },
    { key: 'brand', title: SECTION_LABELS.brand, items: brandItems },
    { key: 'included', title: SECTION_LABELS.included, items: includedItems },
  ];
}

// The DELTA: what each plan adds over the one below it. Kept short on purpose —
// the headline already shows the crowd size, so these are the qualitative wins.
const DELTA_INTRO: Record<PlanCode, string | null> = {
  free: null,
  plus_25: 'Everything in Free, plus:',
  plus_50: 'Everything in Party, plus:',
  pro: 'Everything in Venue, plus:',
};

const DELTA_ITEMS: Record<PlanCode, string[]> = {
  free: ['Every feature included', 'Free forever — Glow branded'],
  plus_25: ['No ads', '3× the crowd'],
  plus_50: ['Your logo on stage', 'Your QR + social links', 'No Glow watermark'],
  pro: ['Unlimited crowd size', 'Built for festival-scale rooms'],
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
    priceLabel: planCode === 'free' ? 'Free' : formatPlanPrice(meta?.priceCents ?? 0),
    headline: devicesLabel(ents.maxDevices),
    deltaIntro: DELTA_INTRO[planCode],
    deltaItems: DELTA_ITEMS[planCode],
    detailSections: buildDetailSections(ents),
  };
}

// Re-export for consumers that display the device cap.
export { formatDeviceCap };
