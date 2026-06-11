'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceTargetSlider } from './device-target-slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NeonButton, NeonTitle } from '@/components/ui/neon';
import { cn } from '@/lib/utils';
import { ORCHESTRATOR_SCHEDULE_MS } from '@/lib/glow/orchestrator-delay';
import { TORCH_MAX_INTERVAL_MS } from '@/lib/glow/torch';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import type { DeviceTarget, RoomStatePayload, TorchCommand } from '@/lib/glow/types';

type TorchControlsProps = {
  roomCode: string;
  roomState: RoomStatePayload;
  socket: { current: { emit: (event: string, payload: unknown) => void } | null };
  disabled?: boolean;
};

type HoldMode = 'pulse' | 'strobe';

export function TorchControls({
  roomCode,
  roomState,
  socket,
  disabled = false,
}: TorchControlsProps) {
  const [target, setTarget] = useState<DeviceTarget>({ kind: 'all' });
  const [onMs, setOnMs] = useState('125');
  const [offMs, setOffMs] = useState('125');
  const [activeHold, setActiveHold] = useState<HoldMode | null>(null);

  const holdingRef = useRef(false);
  const activeHoldRef = useRef<HoldMode | null>(null);

  const { teamEntitlements } = useTeamEntitlements();
  const entitlements = mergeEntitlementsForUi(roomState.entitlements, teamEntitlements);
  const gated = !entitlements.deviceFlashControl;

  const flashCapableCount = useMemo(
    () =>
      roomState.devices.filter(
        (device) => device.torchCapability?.supported && device.torchCapability.enabled
      ).length,
    [roomState.devices]
  );

  const targetedCount = useMemo(() => {
    if (target.kind === 'all') return roomState.devices.length;
    if (target.kind === 'devices') {
      return roomState.devices.filter((device) => target.publicIds.includes(device.publicId)).length;
    }
    if (target.kind === 'fraction') {
      const sorted = [...roomState.devices].sort(
        (a, b) => a.joinedAt - b.joinedAt || a.publicId.localeCompare(b.publicId)
      );
      const start = Math.floor(target.from * sorted.length);
      const end = Math.min(sorted.length, Math.round(target.to * sorted.length));
      return sorted.slice(start, end).length;
    }
    return 0;
  }, [roomState.devices, target]);

  const emitTorch = useCallback(
    (command: TorchCommand) => {
      const targetTimestamp = Date.now() + ORCHESTRATOR_SCHEDULE_MS;
      socket.current?.emit('orchestrator:set_torch', {
        roomCode: roomCode.toUpperCase(),
        target,
        command,
        targetTimestamp,
      });
    },
    [roomCode, socket, target]
  );

  const releaseHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    activeHoldRef.current = null;
    setActiveHold(null);
    emitTorch({ action: 'off' });
  }, [emitTorch]);

  const startHold = useCallback(
    (mode: HoldMode) => {
      if (disabled || gated || holdingRef.current) return;
      holdingRef.current = true;
      activeHoldRef.current = mode;
      setActiveHold(mode);

      if (mode === 'pulse') {
        emitTorch({ action: 'hold', mode: 'pulse' });
        return;
      }

      emitTorch({
        action: 'hold',
        mode: 'strobe',
        onMs: Math.min(
          TORCH_MAX_INTERVAL_MS,
          Math.max(50, Number.parseInt(onMs, 10) || 125)
        ),
        offMs: Math.min(
          TORCH_MAX_INTERVAL_MS,
          Math.max(50, Number.parseInt(offMs, 10) || 125)
        ),
      });
    },
    [disabled, emitTorch, gated, offMs, onMs]
  );

  useEffect(() => {
    const handleBlur = () => releaseHold();
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
      releaseHold();
    };
  }, [releaseHold]);

  function renderGatedOverlay() {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm">
        <p className="px-4 text-center text-xs font-cyber uppercase tracking-widest text-zinc-300">
          Device flash control requires Plus 25 or higher
        </p>
      </div>
    );
  }

  function bindHoldHandlers(mode: HoldMode) {
    return {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startHold(mode);
      },
      onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        releaseHold();
      },
      onPointerCancel: () => releaseHold(),
      onLostPointerCapture: () => releaseHold(),
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    };
  }

  return (
    <div className="relative">
      {gated ? renderGatedOverlay() : null}
      <div className={cn('flex flex-col gap-5', gated && 'pointer-events-none opacity-50')}>
        <div>
          <NeonTitle as="h3" color="white" className="text-base font-black tracking-widest">
            Device Flash / Torch
          </NeonTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Hold Pulse or Strobe to flash targeted devices. Release to stop — effects never stay
            latched on.
          </p>
          <p className="mt-2 text-[10px] font-cyber uppercase tracking-wider text-zinc-400">
            {flashCapableCount} flash-capable / {targetedCount} targeted devices
          </p>
        </div>

        <DeviceTargetSlider
          devices={roomState.devices}
          value={target}
          onChange={setTarget}
        />

        <div className="grid grid-cols-2 gap-2">
          <NeonButton
            color="magenta"
            variant="solid"
            disabled={disabled || gated}
            className={cn(
              'touch-none text-[10px] uppercase tracking-widest h-12 select-none',
              activeHold === 'pulse' && 'ring-2 ring-white/70'
            )}
            style={{ touchAction: 'none' }}
            {...bindHoldHandlers('pulse')}
          >
            Hold Pulse
          </NeonButton>
          <NeonButton
            color="violet"
            variant="solid"
            disabled={disabled || gated}
            className={cn(
              'touch-none text-[10px] uppercase tracking-widest h-12 select-none',
              activeHold === 'strobe' && 'ring-2 ring-white/70'
            )}
            style={{ touchAction: 'none' }}
            {...bindHoldHandlers('strobe')}
          >
            Hold Strobe
          </NeonButton>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="torchOnMs" className="text-[10px] font-cyber uppercase tracking-wider text-zinc-400">
              Strobe on (ms)
            </Label>
            <Input
              id="torchOnMs"
              type="number"
              min={50}
              max={TORCH_MAX_INTERVAL_MS}
              value={onMs}
              onChange={(e) => setOnMs(e.target.value)}
              className="mt-1 h-9 border-white/10 text-xs text-white"
            />
          </div>
          <div>
            <Label htmlFor="torchOffMs" className="text-[10px] font-cyber uppercase tracking-wider text-zinc-400">
              Strobe off (ms)
            </Label>
            <Input
              id="torchOffMs"
              type="number"
              min={50}
              max={TORCH_MAX_INTERVAL_MS}
              value={offMs}
              onChange={(e) => setOffMs(e.target.value)}
              className="mt-1 h-9 border-white/10 text-xs text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
