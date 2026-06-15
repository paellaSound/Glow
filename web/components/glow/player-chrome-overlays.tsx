'use client';

import {
  getUserLogoLayer,
  shouldShowPlayerWatermark,
  shouldShowUserLogo,
  type PlayerChromeConfig,
} from '@/lib/glow/player-chrome-config';
import type { PlanEntitlements } from '@/lib/glow/types';
import { PlayerLogoOverlay } from '@/components/glow/player-logo-overlay';
import { PlayerWatermark } from '@/components/glow/player-watermark';

type PlayerChromeOverlaysProps = {
  playerChrome: PlayerChromeConfig;
  entitlements: Pick<PlanEntitlements, 'removeWatermark' | 'customRigLogo'>;
  logoUrl?: string | null;
  hidden?: boolean;
};

export function PlayerChromeOverlays({
  playerChrome,
  entitlements,
  logoUrl = null,
  hidden = false,
}: PlayerChromeOverlaysProps) {
  if (hidden) return null;

  const userLogoLayer = getUserLogoLayer(playerChrome);
  const showWatermark = shouldShowPlayerWatermark(entitlements, logoUrl, userLogoLayer.visible);
  const showLogo = shouldShowUserLogo(entitlements, logoUrl, userLogoLayer);

  return (
    <>
      {showWatermark ? <PlayerWatermark className="bottom-3 right-3" /> : null}
      {showLogo && logoUrl ? (
        <PlayerLogoOverlay url={logoUrl} layer={userLogoLayer} />
      ) : null}
    </>
  );
}
