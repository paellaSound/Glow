import type { PlanEntitlements } from '@/lib/glow/types';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import {
  formatPlanPrice,
  formatDeviceCap,
  getPlanMeta,
  UNLIMITED_DEVICES_THRESHOLD,
  type PlanCode,
} from './plan-meta';

// MODELO ACTUAL: todas las features están incluidas en todos los planes. Lo que
// diferencia a los planes es la ESCALA (dispositivos) y el BRANDING (logo + marca
// de agua). La copy de abajo lo refleja: las secciones Stage/Floor/Crowd muestran
// "todo incluido" igual en todos, y Scale/Branding son los diferenciadores.

export type BillingSectionKey = 'scale' | 'branding' | 'show' | 'crowd';

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
  scale: 'Scale (lo que pagas)',
  branding: 'Branding',
  show: 'Show — todo incluido',
  crowd: 'Crowd — todo incluido',
};

function devicesLabel(maxDevices: number): string {
  return maxDevices >= UNLIMITED_DEVICES_THRESHOLD
    ? 'Dispositivos ilimitados'
    : `Hasta ${maxDevices} dispositivos`;
}

function matrixLabel(cells: number, rows: number, cols: number): string {
  if (cells >= UNLIMITED_DEVICES_THRESHOLD) return 'Matrix sin límite práctico';
  return `Hasta ${cells} celdas de matrix (grid máx ${rows}×${cols})`;
}

function buildSections(planCode: PlanCode, ents: PlanEntitlements): BillingSection[] {
  // Scale = el eje que se paga
  const scaleItems: string[] = [
    devicesLabel(ents.maxDevices),
    matrixLabel(ents.maxMatrixCells, ents.maxGridRows, ents.maxGridCols),
    ents.adsEnabled ? 'House ads al entrar' : 'Sin ads',
  ];
  if (ents.requiresCoverageAck) {
    scaleItems.push('Aforo masivo (sujeto a cobertura de red de la zona)');
  }

  // Branding = el otro eje que se paga
  const brandingItems: string[] = [
    ents.removeWatermark ? 'Sin marca de agua Glow' : `Marca de agua ${GLOW_BRAND_NAME}`,
    ents.customRigLogo ? 'Tu logo en escena' : `Logo ${GLOW_BRAND_NAME} en escena`,
    ents.customQrBranding ? 'Tu QR + redes sociales' : `QR ${GLOW_BRAND_NAME}`,
  ];

  // Show / Crowd = mismas features en todos los planes (todo incluido)
  const showItems: string[] = [
    'Visuals surface + preview en el desk',
    'YouTube & 3D, todos los modos',
    'Todos los presets de luz + audio-reactivo',
    'Capas de efectos, secuencias y texto',
    'Subida de imágenes + búsqueda GIF completa',
    'Flash / linterna de dispositivos',
  ];

  const crowdItems: string[] = [
    'Reacciones de la audiencia',
    'Encuestas en directo',
    'Mosaico de cámara en vivo (live call)',
  ];

  return [
    { key: 'scale', title: SECTION_LABELS.scale, items: scaleItems },
    { key: 'branding', title: SECTION_LABELS.branding, items: brandingItems },
    { key: 'show', title: SECTION_LABELS.show, items: showItems },
    { key: 'crowd', title: SECTION_LABELS.crowd, items: crowdItems },
  ];
}

const BRANDING_NOTES: Record<PlanCode, string> = {
  free: `Marca ${GLOW_BRAND_NAME} — ideal para que te descubran`,
  plus_25: `Marca ${GLOW_BRAND_NAME} en logo / QR`,
  plus_50: 'Tu logo en escena + QR social, sin marca de agua',
  pro: 'Tu marca + escala ilimitada',
};

const TAGLINES: Record<PlanCode, string> = {
  free: 'Prueba el show completo',
  plus_25: 'Escala tu fiesta',
  plus_50: 'Tu marca en escena',
  pro: 'Escala ilimitada',
};

const CTAS: Record<PlanCode, string> = {
  free: 'Plan actual',
  plus_25: 'Escala tu fiesta',
  plus_50: 'Tu marca en escena',
  pro: 'Escala sin límites',
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

// Reexport para consumidores que muestren el cap de dispositivos.
export { formatDeviceCap };
