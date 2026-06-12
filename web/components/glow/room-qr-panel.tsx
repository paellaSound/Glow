'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import type { RigSocial } from '@/lib/glow/social-kinds';
import { GlowLogo } from '@/components/glow/glow-logo';
import { RigSocialLinks } from '@/components/glow/rig-social-links';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import { cn } from '@/lib/utils';

type RoomQrPanelProps = {
  roomCode: string;
  matrixEnabled: boolean;
  rigName?: string | null;
  socials?: RigSocial[];
  qrSize?: number;
  variant?: 'light' | 'dark';
  showJoinUrl?: boolean;
  className?: string;
  customQrBranding?: boolean;
  glowBrandName?: string;
};

export function RoomQrPanel({
  roomCode,
  matrixEnabled,
  rigName,
  socials,
  qrSize = 640,
  variant = 'light',
  showJoinUrl = true,
  className,
  customQrBranding = true,
  glowBrandName = GLOW_BRAND_NAME,
}: RoomQrPanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const code = roomCode.toUpperCase();

  const joinUrl = useMemo(
    () => buildPlayerJoinUrl(code, { matrix: matrixEnabled }),
    [code, matrixEnabled]
  );

  useEffect(() => {
    void QRCode.toDataURL(joinUrl, {
      width: qrSize,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl);
  }, [joinUrl, qrSize]);

  const isLight = variant === 'light';

  return (
    <div className={cn('flex flex-col items-center gap-6 text-center', className)}>
      <div>
        {customQrBranding ? (
          <>
            <p
              className={cn(
                'text-sm uppercase tracking-[0.3em]',
                isLight ? 'text-zinc-500' : 'text-zinc-400'
              )}
            >
              Glow Room
            </p>
            {rigName ? (
              <h1
                className={cn(
                  'mt-2 text-3xl font-bold tracking-wide sm:text-4xl',
                  isLight ? 'text-black' : 'text-white'
                )}
              >
                {rigName}
              </h1>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <GlowLogo className="h-10 w-auto text-neon-magenta" />
            <h1
              className={cn(
                'text-2xl font-black tracking-widest uppercase sm:text-3xl',
                isLight ? 'text-black' : 'text-white'
              )}
            >
              {glowBrandName}
            </h1>
          </div>
        )}
        <p
          className={cn(
            'font-bold tracking-widest',
            rigName ? 'mt-2 text-2xl sm:text-3xl' : 'mt-2 text-5xl',
            isLight ? 'text-black' : 'text-white'
          )}
        >
          {code}
        </p>
        <p className={cn('mt-3 text-lg', isLight ? 'text-zinc-600' : 'text-zinc-300')}>
          {matrixEnabled ? 'Scan to join and pick your position' : 'Scan to join'}
        </p>
      </div>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR code for room ${code}`}
          className="h-auto w-full max-w-[min(80vw,640px)] rounded-2xl border border-zinc-200 shadow-lg"
        />
      ) : (
        <div className="h-[min(80vw,640px)] w-[min(80vw,640px)] animate-pulse rounded-2xl bg-zinc-100" />
      )}

      {customQrBranding ? <RigSocialLinks socials={socials} variant={variant} /> : null}

      {showJoinUrl ? (
        <p className={cn('max-w-xl break-all text-sm', isLight ? 'text-zinc-500' : 'text-zinc-400')}>
          {joinUrl}
        </p>
      ) : null}
    </div>
  );
}
