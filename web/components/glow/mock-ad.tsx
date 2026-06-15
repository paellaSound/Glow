'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureClientEvent } from '@/lib/posthog-client';
import { GlowLogo } from '@/components/glow/glow-logo';
import { NeonButton, NeonCard, NeonTitle, SectionGlow } from '@/components/ui/neon';
import { cn } from '@/lib/utils';

type MockAdProps = {
  placement: 'room_create' | 'room_join';
  onComplete: () => void;
  onTrack?: () => void;
};

const PHONE_DELAYS = ['delay-0', 'delay-75', 'delay-150', 'delay-300', 'delay-500', 'delay-700'] as const;

const PLACEMENT_COPY = {
  room_create: {
    headline: 'Host the show',
    subline: 'Every device becomes a synchronized light',
    badge: 'Free plan',
  },
  room_join: {
    headline: 'Join the grid',
    subline: 'This screen will pulse with the room',
    badge: 'Guest device',
  },
} as const;

function GlowHouseAdCreative({
  placement,
  synced,
}: {
  placement: MockAdProps['placement'];
  synced: boolean;
}) {
  const copy = PLACEMENT_COPY[placement];

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-neon-cyan/20 bg-zinc-950/90">
      <SectionGlow glowColor="mixed" position="center" className="opacity-60" />

      {/* Central hub */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-700',
            synced
              ? 'bg-neon-magenta/30 neon-glow-magenta scale-110'
              : 'bg-neon-cyan/20 neon-glow-cyan scale-100'
          )}
        >
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-60',
              synced ? 'animate-ping bg-neon-magenta' : 'animate-ping bg-neon-cyan'
            )}
          />
          <span className="relative h-3 w-3 rounded-full bg-white/90" />
        </span>
      </div>

      {/* Device ring */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-28 w-28">
          {PHONE_DELAYS.map((delay, index) => {
            const angle = (index / PHONE_DELAYS.length) * Math.PI * 2 - Math.PI / 2;
            const x = 50 + Math.cos(angle) * 42;
            const y = 50 + Math.sin(angle) * 42;

            return (
              <div
                key={delay}
                className={cn(
                  'absolute h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border transition-all duration-500',
                  synced
                    ? 'border-neon-cyan bg-neon-cyan/80 neon-glow-cyan'
                    : cn('border-neon-magenta/40 bg-neon-magenta/25', 'animate-pulse', delay)
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Brand + copy */}
      <div className="relative z-10 flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlowLogo className="h-5 w-5 shrink-0" />
            <div className="leading-none">
              <span className="block font-display text-sm font-extrabold uppercase tracking-widest text-neon-cyan neon-text-cyan">
                Glow
              </span>
              <span className="block font-cyber text-[9px] uppercase tracking-widest text-neon-magenta/90">
                The Rave
              </span>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-cyber text-[8px] uppercase tracking-widest text-muted-foreground">
            {copy.badge}
          </span>
        </div>

        <div
          className={cn(
            'space-y-1 transition-all duration-700',
            synced ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          )}
        >
          <p className="font-display text-sm font-black uppercase tracking-wide text-foreground">
            {copy.headline}
          </p>
          <p className="font-cyber text-[10px] uppercase tracking-wider text-muted-foreground">
            {copy.subline}
          </p>
        </div>
      </div>

      {/* Sync flash overlay */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-neon-cyan/10 transition-opacity duration-300',
          synced ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

export function MockAd({ placement, onComplete, onTrack }: MockAdProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    onTrack?.();
    captureClientEvent('ad_viewed', { placement });
  }, []);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setSynced(true), 900);
    return () => window.clearTimeout(syncTimer);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-background/85 p-4 backdrop-blur-md duration-300">
      <NeonCard
        glowColor="cyan"
        borderVariant="cyan"
        hoverEffect={false}
        className="w-full max-w-md animate-in zoom-in-95 p-0 duration-300"
      >
        <div className="border-b border-white/5 px-5 py-4">
          <NeonTitle as="h2" color="cyan" className="text-xs font-black tracking-[0.2em]">
            Presented by Glow
          </NeonTitle>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <GlowHouseAdCreative placement={placement} synced={synced} />

          <p className="text-center font-cyber text-[10px] uppercase tracking-wider text-muted-foreground">
            {placement === 'room_create'
              ? 'Upgrade to Party for more devices & no ads'
              : 'Powered by Glow — sync lights across every screen'}
          </p>

          <Link
            href="/billing"
            className="block text-center font-cyber text-[10px] uppercase tracking-widest text-neon-magenta/80 transition-colors hover:text-neon-magenta neon-text-magenta"
          >
            Go ad-free →
          </Link>

          <NeonButton
            type="button"
            color="cyan"
            variant="solid"
            className="h-11 w-full text-xs uppercase tracking-widest"
            disabled={secondsLeft > 0}
            onClick={onComplete}
          >
            {secondsLeft > 0 ? `Continue in ${secondsLeft}s` : 'Continue'}
          </NeonButton>
        </div>
      </NeonCard>
    </div>
  );
}
