'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { DeviceTargetSlider } from './device-target-slider';
import { PlanGateUpsell } from '@/components/glow/plan-gate';
import { UpgradeModal } from '@/components/glow/upgrade-modal';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { cn } from '@/lib/utils';
import { buildLayoutPreset } from '@/lib/glow/webrtc';
import type {
  DeviceTarget,
  LiveCallPublisherStatus,
  PlanEntitlements,
  RoomStatePayload,
} from '@/lib/glow/types';
import { showLiveCallTestDesk } from '@/lib/plans/freemium-depth';
import { useLiveCallDesk } from '@/lib/glow/use-live-call-desk';

type LiveCallControlsProps = {
  roomCode: string;
  roomState: RoomStatePayload;
  entitlements: PlanEntitlements;
  socket: React.MutableRefObject<Socket | null>;
  connected: boolean;
};

function statusLabel(status: LiveCallPublisherStatus): string {
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'live':
      return 'Live';
    case 'declined':
      return 'Declined';
    default:
      return status;
  }
}

function statusColor(status: LiveCallPublisherStatus): string {
  switch (status) {
    case 'requested':
      return 'text-amber-400';
    case 'live':
      return 'text-green-400';
    case 'declined':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function LayoutPreview({
  deviceIds,
  deviceNameById,
  layoutPreset,
}: {
  deviceIds: string[];
  deviceNameById: Map<string, string>;
  layoutPreset: 'pip' | 'half' | '2x2' | '3x3';
}) {
  const tiles = buildLayoutPreset(deviceIds, layoutPreset);

  return (
    <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/50">
      {tiles.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-cyber uppercase tracking-widest text-zinc-500">
          Select devices to preview layout
        </div>
      ) : (
        tiles.map((tile) => (
          <div
            key={tile.publicId}
            className="absolute flex items-center justify-center border border-neon-magenta/30 bg-neon-magenta/10 text-[8px] font-cyber uppercase tracking-wider text-neon-magenta"
            style={{
              left: `${tile.x * 100}%`,
              top: `${tile.y * 100}%`,
              width: `${tile.w * 100}%`,
              height: `${tile.h * 100}%`,
            }}
          >
            {deviceNameById.get(tile.publicId) ?? tile.publicId.slice(0, 6)}
          </div>
        ))
      )}
      <span className="absolute left-2 top-2 rounded bg-violet-500/20 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-violet-200">
        Preview
      </span>
    </div>
  );
}

export function LiveCallControls({
  roomCode,
  roomState,
  entitlements,
  connected,
}: LiveCallControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  const production = entitlements.webrtcLiveCall;
  const testMode = showLiveCallTestDesk(entitlements);
  const maxDevices = entitlements.maxLiveCallDevices;
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const {
    target,
    setTarget,
    liveState,
    layoutPreset,
    setLayoutPreset,
    starting,
    error,
    selectedIds,
    handleGoLive,
    handleStopAll,
    handleStopOne,
    handleApplyLayout,
  } = useLiveCallDesk();

  const deviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of roomState.devices) {
      map.set(d.publicId, d.nickname || d.publicId.slice(0, 6));
    }
    return map;
  }, [roomState.devices]);

  if (!production && !testMode) {
    return (
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
        <div className="text-center py-4">
          <span className="text-2xl">🔒</span>
          <NeonTitle as="h3" color="violet" className="text-sm font-black tracking-widest mt-3 mb-2">
            LIVE CALL MOSAIC
          </NeonTitle>
          <PlanGateUpsell feature="webrtcLiveCall" />
        </div>
      </NeonCard>
    );
  }

  if (testMode) {
    return (
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
        <div className="mb-4">
          <NeonTitle as="h3" color="violet" className="text-xs font-black tracking-widest">
            LIVE CALL MOSAIC
          </NeonTitle>
          <p className="mt-1 text-xs text-violet-200/80">
            Preview — upgrade to Pro for live camera mosaic on the projector.
          </p>
        </div>

        <DeviceTargetSlider
          devices={roomState.devices}
          value={target}
          onChange={setTarget}
        />

        <div className="mt-4">
          <p className="text-[10px] font-cyber uppercase tracking-wider text-zinc-400 mb-2">
            Layout preset
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'pip' as const, label: 'PiP' },
                { id: 'half' as const, label: 'Half' },
                { id: '2x2' as const, label: '2×2' },
                { id: '3x3' as const, label: '3×3' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setLayoutPreset(id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[10px] font-cyber uppercase tracking-widest transition-all',
                  layoutPreset === id
                    ? 'border-neon-violet/50 bg-neon-violet/15 text-neon-violet'
                    : 'border-white/10 text-zinc-500 hover:text-zinc-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <LayoutPreview
          deviceIds={selectedIds}
          deviceNameById={deviceNameById}
          layoutPreset={layoutPreset}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <NeonButton
            color="violet"
            variant="solid"
            onClick={() => setUpgradeOpen(true)}
            disabled={!connected || selectedIds.length === 0}
            className="text-xs uppercase tracking-widest h-9 px-4"
          >
            Go live (Pro)
          </NeonButton>
        </div>

        <PlanGateUpsell feature="webrtcLiveCall" className="mt-4" />
        <UpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          title="Live camera mosaic requires Pro"
          body="Upgrade to Pro to publish device cameras to the visuals surface."
          requiredPlan="pro"
          returnUrl={returnUrl}
          hasActiveSubscription={false}
        />
      </NeonCard>
    );
  }

  return (
    <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-5">
      <div className="mb-4">
        <NeonTitle as="h3" color="magenta" className="text-xs font-black tracking-widest">
          LIVE CALL MOSAIC
        </NeonTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Select up to {maxDevices} devices to show their cameras on the visuals surface.
        </p>
      </div>

      <DeviceTargetSlider
        devices={roomState.devices}
        value={target}
        onChange={(next) => {
          if (next.kind === 'devices' && next.publicIds.length > maxDevices) {
            setTarget({ kind: 'devices', publicIds: next.publicIds.slice(0, maxDevices) });
            return;
          }
          setTarget(next);
        }}
      />

      <div className="mt-4">
        <p className="text-[10px] font-cyber uppercase tracking-wider text-zinc-400 mb-2">
          Layout preset
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'pip' as const, label: 'PiP' },
              { id: 'half' as const, label: 'Half' },
              { id: '2x2' as const, label: '2×2' },
              { id: '3x3' as const, label: '3×3' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayoutPreset(id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[10px] font-cyber uppercase tracking-widest transition-all',
                layoutPreset === id
                  ? 'border-neon-magenta/50 bg-neon-magenta/15 text-neon-magenta'
                  : 'border-white/10 text-zinc-500 hover:text-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-zinc-500 font-cyber tracking-wide">
          PiP = corner quarter · Half = bottom strip · grids for multiple cams
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <NeonButton
          color="magenta"
          variant="solid"
          onClick={() => void handleGoLive()}
          disabled={!connected || starting || selectedIds.length === 0}
          className="text-xs uppercase tracking-widest h-9 px-4"
        >
          {starting ? 'Starting…' : 'Go live'}
        </NeonButton>

        {liveState?.active ? (
          <>
            <NeonButton
              color="magenta"
              variant="outline"
              onClick={handleApplyLayout}
              disabled={!connected}
              className="text-xs uppercase tracking-widest h-9 px-4"
            >
              Apply layout
            </NeonButton>
            <NeonButton
              color="magenta"
              variant="outline"
              onClick={handleStopAll}
              disabled={!connected}
              className="text-xs uppercase tracking-widest h-9 px-4 border-red-500/30 text-red-400"
            >
              Stop all
            </NeonButton>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-[10px] text-red-400 font-cyber uppercase tracking-wide">{error}</p>
      ) : null}

      {liveState?.active && liveState.publishers.length > 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-muted/50 p-3">
          <p className="text-[10px] font-cyber uppercase tracking-wider text-zinc-400 mb-2">
            Publisher status
          </p>
          <ul className="space-y-2">
            {liveState.publishers.map((pub) => (
              <li
                key={pub.publicId}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-cyber text-zinc-300 truncate">
                  {deviceNameById.get(pub.publicId) ?? pub.publicId.slice(0, 6)}
                </span>
                <div className="flex items-center gap-2 flex-none">
                  <span className={cn('text-[10px] font-cyber uppercase', statusColor(pub.status))}>
                    {statusLabel(pub.status)}
                  </span>
                  {pub.status !== 'declined' ? (
                    <button
                      type="button"
                      onClick={() => handleStopOne(pub.publicId)}
                      className="text-[9px] font-cyber uppercase tracking-wider text-red-400 hover:underline"
                    >
                      Stop
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </NeonCard>
  );
}
