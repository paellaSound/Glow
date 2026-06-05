'use client';

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGlowSocket } from '@/lib/glow/socket';
import { useVisualEngine } from '@/lib/glow/visual-engine';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { WakeLock } from '@/components/glow/wake-lock';
import { Button } from '@/components/ui/button';
import { labelFromPosition } from '@/lib/glow/matrix';
import { parseMatrixParam } from '@/lib/glow/join-url';
import {
  clearStoredDeviceId,
  getStoredDeviceId,
  storeDeviceId,
} from '@/lib/glow/player-session';
import { useOrchestratorDelay } from '@/lib/glow/use-orchestrator-delay';
import type {
  FallbackModeEvent,
  VisualColorEvent,
  VisualPresetEvent,
} from '@/lib/glow/types';

type JoinResponse = {
  accepted: boolean;
  reason?: string;
  reconnected?: boolean;
  devicePublicId?: string;
  label?: string;
  row?: number;
  col?: number;
  matrix?: { rows: number; cols: number };
};

function PlayerContent({
  code,
  nickname,
  matrixRequired,
}: {
  code: string;
  nickname?: string;
  matrixRequired: boolean;
}) {
  const roomCode = code.toUpperCase();
  const { connected, emit, emitWithCallback, on } = useGlowSocket();
  const [joined, setJoined] = useState(false);
  const { delayMs, trackOrchestratorMessage } = useOrchestratorDelay({
    connected,
    enabled: joined,
    emit,
    on,
  });
  const [devicePublicId, setDevicePublicId] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ row: number; col: number; label?: string } | null>(
    null
  );
  const [matrixSize, setMatrixSize] = useState({ rows: 3, cols: 3 });
  const [pickMode, setPickMode] = useState(matrixRequired);
  const wasConnectedRef = useRef(false);

  const visual = useVisualEngine({
    roomCode,
    row: position?.row ?? 0,
    col: position?.col ?? 0,
    matrixRows: matrixSize.rows,
    matrixCols: matrixSize.cols,
  });

  const applyJoinResponse = useCallback(
    (response: JoinResponse) => {
      if (!response.accepted) return false;

      setJoined(true);
      setConnectionLost(false);
      setReconnectError(null);

      if (response.devicePublicId) {
        setDevicePublicId(response.devicePublicId);
        storeDeviceId(roomCode, response.devicePublicId);
      }

      if (response.matrix) setMatrixSize(response.matrix);

      if (response.row !== undefined && response.col !== undefined) {
        setPosition({ row: response.row, col: response.col, label: response.label });
        setPickMode(false);
      } else if (!matrixRequired) {
        setPickMode(false);
      }

      return true;
    },
    [matrixRequired, roomCode]
  );

  const attemptRejoin = useCallback(
    async (publicId: string) => {
      setReconnecting(true);
      setReconnectError(null);

      const response = await emitWithCallback<JoinResponse>('player:rejoin_room', {
        roomCode,
        devicePublicId: publicId,
        nickname,
      });

      setReconnecting(false);

      if (applyJoinResponse(response)) {
        return true;
      }

      clearStoredDeviceId(roomCode);
      setDevicePublicId(null);
      setReconnectError(response.reason ?? 'Could not reconnect');
      return false;
    },
    [applyJoinResponse, emitWithCallback, nickname, roomCode]
  );

  const joinAsNewPlayer = useCallback(async () => {
    const response = await emitWithCallback<JoinResponse>('player:join_room', {
      roomCode,
      nickname,
    });

    if (!applyJoinResponse(response)) {
      alert(response.reason ?? 'Could not join room');
    }
  }, [applyJoinResponse, emitWithCallback, nickname, roomCode]);

  useEffect(() => {
    if (!connected || joined) return;

    async function joinOrRejoin() {
      const storedId = getStoredDeviceId(roomCode);
      if (storedId) {
        const rejoined = await attemptRejoin(storedId);
        if (rejoined) return;
      }

      await joinAsNewPlayer();
    }

    void joinOrRejoin();
  }, [connected, joined, roomCode, attemptRejoin, joinAsNewPlayer]);

  useEffect(() => {
    if (!joined) return;

    if (connected) {
      wasConnectedRef.current = true;
      return;
    }

    if (wasConnectedRef.current) {
      setConnectionLost(true);
    }
  }, [connected, joined]);

  useEffect(() => {
    if (!connected || !connectionLost || !devicePublicId || reconnecting) return;
    void attemptRejoin(devicePublicId);
  }, [connected, connectionLost, devicePublicId, reconnecting, attemptRejoin]);

  useEffect(() => {
    const unsubscribers = [
      on('visual:color', (event) => {
        const payload = event as VisualColorEvent;
        trackOrchestratorMessage(payload.targetTimestamp);
        visual.scheduleColor(payload);
      }),
      on('visual:preset', (event) => {
        const payload = event as VisualPresetEvent;
        trackOrchestratorMessage(payload.targetTimestamp, payload.seedTimestamp);
        visual.schedulePreset(payload);
      }),
      on('fallback:mode_changed', (event) => {
        const payload = event as FallbackModeEvent;
        trackOrchestratorMessage(payload.seedTimestamp, payload.seedTimestamp);
        visual.setFallbackMode(payload);
      }),
      on('device:identify', (event) => {
        const payload = event as { label: string };
        visual.triggerIdentify(payload.label);
      }),
      on('device:position_updated', (event) => {
        const payload = event as { row: number; col: number; label: string };
        setPosition(payload);
        setPickMode(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [on, trackOrchestratorMessage, visual]);

  async function requestPosition(row: number, col: number) {
    const response = await emitWithCallback<{
      ok: boolean;
      reason?: string;
      label?: string;
      row?: number;
      col?: number;
    }>('player:request_position', {
      roomCode,
      row,
      col,
    });

    if (!response.ok) {
      alert(response.reason ?? 'Position unavailable');
      return;
    }

    setPosition({ row: response.row!, col: response.col!, label: response.label });
    setPickMode(false);
  }

  async function handleManualReconnect() {
    if (!devicePublicId) return;
    await attemptRejoin(devicePublicId);
  }

  async function handleJoinAsNew() {
    clearStoredDeviceId(roomCode);
    setDevicePublicId(null);
    setJoined(false);
    setConnectionLost(false);
    setReconnectError(null);
    await joinAsNewPlayer();
  }

  const displayLabel = visual.identifyLabel ?? position?.label;
  const statusLabel = reconnecting
    ? 'Reconnecting...'
    : connected
      ? 'Online'
      : connectionLost
        ? 'Disconnected'
        : 'Connecting...';

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col"
      style={{ backgroundColor: visual.identifying ? '#ffffff' : visual.color }}
    >
      <WakeLock />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="rounded bg-black/40 px-3 py-1 text-xs text-white">
          {statusLabel}
          {joined && connected && delayMs !== null ? ` (${delayMs}ms)` : ''}
        </div>
        <FullscreenButton />
      </div>

      {!pickMode && displayLabel ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={`font-bold ${visual.identifying ? 'text-black' : 'text-white/20'}`}
            style={{ fontSize: visual.identifying ? '20vw' : '30vw' }}
          >
            {displayLabel}
          </span>
        </div>
      ) : null}

      {matrixRequired && pickMode && joined && connected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-center text-white">Pick your position</p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${matrixSize.cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: matrixSize.rows * matrixSize.cols }).map((_, index) => {
              const row = Math.floor(index / matrixSize.cols);
              const col = index % matrixSize.cols;
              return (
                <Button
                  key={`${row}-${col}`}
                  variant="outline"
                  className="aspect-square border-white/20 bg-black/30 text-white"
                  onClick={() => void requestPosition(row, col)}
                >
                  {labelFromPosition(row, col)}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {connectionLost && !reconnecting ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/20 bg-black/70 p-4 text-center text-white backdrop-blur">
            <p className="text-sm">Connection lost. Rejoin with your saved player ID.</p>
            {reconnectError ? (
              <p className="mt-2 text-xs text-amber-300">{reconnectError}</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => void handleManualReconnect()} disabled={!devicePublicId}>
                Reconnect
              </Button>
              <Button variant="outline" onClick={() => void handleJoinAsNew()}>
                Join as new player
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerSearchParams({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname') ?? undefined;
  const matrixRequired = parseMatrixParam(searchParams.get('matrix'));
  return (
    <PlayerContent code={code} nickname={nickname} matrixRequired={matrixRequired} />
  );
}

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-black" />}>
      <PlayerSearchParams code={code} />
    </Suspense>
  );
}
