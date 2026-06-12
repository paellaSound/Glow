import type { PlanEntitlements } from '@/lib/glow/types';

export const GLOW_BRAND_NAME = 'Glow Rave';
export const GLOW_LOGO_PATH = '/glow-rave-logo.svg';

export type SurfaceLogo = {
  url: string;
  opacity: number;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
};

export function getGlowLogoUrl(origin?: string): string {
  if (origin) {
    return `${origin.replace(/\/$/, '')}${GLOW_LOGO_PATH}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${GLOW_LOGO_PATH}`;
  }
  const base = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
  return `${base.replace(/\/$/, '')}${GLOW_LOGO_PATH}`;
}

export function buildDefaultGlowSurfaceLogo(origin?: string): SurfaceLogo {
  return {
    url: getGlowLogoUrl(origin),
    opacity: 0.85,
    position: 'center',
    effect: 'pulse',
  };
}

export function resolveSurfaceLogo(
  customLogo: SurfaceLogo | null | undefined,
  entitlements: Pick<PlanEntitlements, 'customRigLogo'>,
  enabled: boolean,
  origin?: string
): SurfaceLogo | null {
  if (!enabled) return null;
  if (entitlements.customRigLogo && customLogo?.url) {
    return customLogo;
  }
  return buildDefaultGlowSurfaceLogo(origin);
}

export function canUseHostQrBranding(
  entitlements: Pick<PlanEntitlements, 'customQrBranding'>
): boolean {
  return Boolean(entitlements.customQrBranding);
}
