'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { DeviceTargetSlider } from './device-target-slider';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { cn } from '@/lib/utils';
import { buildLayoutPreset, type LiveLayoutPreset } from '@/lib/glow/webrtc';
import type {
  DeviceTarget,
  LiveCallPublisherStatus,
  LiveCallStatePayload,
  PlanEntitlements,
  RoomStatePayload,
} from '@/lib/glow/types';


type LiveCallControlsProps = {
  roomCode: string;
  roomState: RoomStatePayload;
  entitlements: PlanEntitlements;
  socket: React.MutableRefObject<Socket | null>;
  connected: boolean;
};

function resolveDevicePublicIds(
  devices: RoomStatePayload['devices'],
  target: DeviceTarget
): string[] {
  if (target.kind === 'all') return devices.map((d) => d.publicId);
  if (target.kind === 'devices') return target.publicIds;
  if (target.kind === 'fraction') {
    const sorted = [...devices].sort(
      (a, b) => a.joinedAt - b.joinedAt || a.publicId.localeCompare(b.publicId)
    );
    const start = Math.floor(target.from * sorted.length);
    const end = Math.min(sorted.length, Math.round(target.to * sorted.length));
    return sorted.slice(start, end).map((d) => d.publicId);
  }
  return [];
}

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

export function LiveCallControls({
  roomCode,
  roomState,
  entitlements,
  socket,
  connected,
}: LiveCallControlsProps) {
  const code = roomCode.toUpperCase();
  const gated = !entitlements.webrtcLiveCall;
  const maxDevices = entitlements.maxLiveCallDevices;

  const [target, setTarget] = useState<DeviceTarget>({ kind: 'devices', publicIds: [] });
  const [liveState, setLiveState] = useState<LiveCallStatePayload | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LiveLayoutPreset>('pip');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onState = (payload: LiveCallStatePayload) => {
      setLiveState(payload);
    };

    s.on('orchestrator:live_call_state', onState);
    return () => {
      s.off('orchestrator:live_call_state', onState);
    };
  }, [socket]);

  const selectedIds = useMemo(
    () => resolveDevicePublicIds(roomState.devices, target).slice(0, maxDevices),
    [roomState.devices, target, maxDevices]
  );

  const deviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of roomState.devices) {
      map.set(d.publicId, d.nickname || d.publicId.slice(0, 6));
    }
    return map;
  }, [roomState.devices]);

  const handleGoLive = useCallback(async () => {
    if (gated || !connected || selectedIds.length === 0) return;
    setStarting(true);
    setError(null);

    try {
      const s = socket.current;
      if (!s) throw new Error('Socket not connected');

      s.timeout(10_000).emit(
        'orchestrator:live_call_start',
        { roomCode: code, publisherIds: selectedIds },
        (err: Error | null, response: { ok: boolean; reason?: string; callId?: string }) => {
          setStarting(false);
          if (err) {
            setError('Request timed out');
            return;
          }
          if (!response.ok) {
            const messages: Record<string, string> = {
              gated: 'Live call requires a Pro plan.',
              over_cap: `Maximum ${maxDevices} devices per live call.`,
              no_publishers: 'Select at least one device.',
              no_connected_publishers: 'Selected devices are not connected.',
            };
            setError(messages[response.reason ?? ''] ?? 'Could not start live call.');
            return;
          }
          if (response.callId) {
            const tiles = buildLayoutPreset(selectedIds, layoutPreset);
            s.emit('orchestrator:live_layout', { roomCode: code, tiles });
          }
        }
      );
    } catch (e: unknown) {
      setStarting(false);
      setError(e instanceof Error ? e.message : 'Could not start live call.');
    }
  }, [gated, connected, selectedIds, socket, code, layoutPreset, maxDevices]);

  const handleStopAll = useCallback(() => {
    socket.current?.emit('orchestrator:live_call_stop', { roomCode: code });
    setLiveState(null);
  }, [socket, code]);

  const handleStopOne = useCallback(
    (publicId: string) => {
      socket.current?.emit('orchestrator:live_call_stop', {
        roomCode: code,
        publisherIds: [publicId],
      });
    },
    [socket, code]
  );

  const handleApplyLayout = useCallback(() => {
    if (!liveState?.active) return;
    const liveIds = liveState.publishers
      .filter((p) => p.status === 'live')
      .map((p) => p.publicId);
    if (liveIds.length === 0) return;
    const tiles = buildLayoutPreset(liveIds, layoutPreset);
    socket.current?.emit('orchestrator:live_layout', { roomCode: code, tiles });
  }, [liveState, layoutPreset, socket, code]);

  if (gated) {
    return (
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
        <div className="text-center py-4">
          <span className="text-2xl">🔒</span>
          <NeonTitle as="h3" color="violet" className="text-sm font-black tracking-widest mt-3 mb-2">
            LIVE CALL MOSAIC
          </NeonTitle>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Show player cameras on the visuals surface. Upgrade to{' '}
            <strong className="text-white">Pro</strong> to unlock live call.
          </p>
        </div>
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
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
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
