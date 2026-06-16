import type { PlanEntitlements } from './types.js';

export const GLOW_BRAND_NAME = 'Glow Rave';
export const GLOW_LOGO_PATH = '/glow-rave-logo.svg';

export type SurfaceLogo = {
  url: string;
  opacity: number;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  /** Free placement (percent of surface). When present it overrides `position`. */
  rect?: { x: number; y: number; width: number };
};

export function getGlowLogoUrl(): string {
  const base =
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${GLOW_LOGO_PATH}`;
}

export function buildDefaultGlowSurfaceLogo(): SurfaceLogo {
  return {
    url: getGlowLogoUrl(),
    opacity: 0.85,
    position: 'center',
    effect: 'pulse',
  };
}

export function resolveSurfaceLogo(
  customLogo: SurfaceLogo | null | undefined,
  entitlements: Pick<PlanEntitlements, 'customRigLogo'>,
  enabled: boolean
): SurfaceLogo | null {
  if (!enabled) return null;
  if (entitlements.customRigLogo && customLogo?.url) {
    return customLogo;
  }
  return buildDefaultGlowSurfaceLogo();
}

export function getPublicRigSocials<T>(room: {
  entitlements: Pick<PlanEntitlements, 'customQrBranding'>;
  rigSocials?: T[];
}): T[] {
  if (!room.entitlements.customQrBranding) return [];
  return room.rigSocials ?? [];
}
