'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGlowSocket } from '@/lib/glow/socket';
import { useVisualEngine } from '@/lib/glow/visual-engine';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { WakeLock } from '@/components/glow/wake-lock';
import { Button } from '@/components/ui/button';
import { labelFromPosition } from '@/lib/glow/matrix';
import { parseMatrixParam } from '@/lib/glow/join-url';
import type {
  FallbackModeEvent,
  VisualColorEvent,
  VisualPresetEvent,
} from '@/lib/glow/types';

function PlayerContent({
  code,
  nickname,
  matrixRequired,
}: {
  code: string;
  nickname?: string;
  matrixRequired: boolean;
}) {
  const { connected, emitWithCallback, on } = useGlowSocket();
  const [joined, setJoined] = useState(false);
  const [position, setPosition] = useState<{ row: number; col: number; label?: string } | null>(
    null
  );
  const [matrixSize, setMatrixSize] = useState({ rows: 3, cols: 3 });
  const [pickMode, setPickMode] = useState(matrixRequired);

  const visual = useVisualEngine({
    roomCode: code.toUpperCase(),
    row: position?.row ?? 0,
    col: position?.col ?? 0,
    matrixRows: matrixSize.rows,
    matrixCols: matrixSize.cols,
  });

  useEffect(() => {
    if (!connected || joined) return;

    void emitWithCallback<{
      accepted: boolean;
      reason?: string;
      label?: string;
      row?: number;
      col?: number;
      matrix?: { rows: number; cols: number };
    }>('player:join_room', {
      roomCode: code.toUpperCase(),
      nickname,
    }).then((response) => {
      if (!response.accepted) {
        alert(response.reason ?? 'Could not join room');
        return;
      }
      setJoined(true);
      if (response.matrix) setMatrixSize(response.matrix);
      if (response.row !== undefined && response.col !== undefined) {
        setPosition({ row: response.row, col: response.col, label: response.label });
        setPickMode(false);
      } else if (!matrixRequired) {
        setPickMode(false);
      }
    });
  }, [connected, joined, code, nickname, matrixRequired, emitWithCallback]);

  useEffect(() => {
    const unsubscribers = [
      on('visual:color', (event) => visual.scheduleColor(event as VisualColorEvent)),
      on('visual:preset', (event) => visual.schedulePreset(event as VisualPresetEvent)),
      on('fallback:mode_changed', (event) =>
        visual.setFallbackMode(event as FallbackModeEvent)
      ),
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
  }, [on, visual]);

  async function requestPosition(row: number, col: number) {
    const response = await emitWithCallback<{
      ok: boolean;
      reason?: string;
      label?: string;
      row?: number;
      col?: number;
    }>('player:request_position', {
      roomCode: code.toUpperCase(),
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

  const displayLabel = visual.identifyLabel ?? position?.label;

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col"
      style={{ backgroundColor: visual.identifying ? '#ffffff' : visual.color }}
    >
      <WakeLock />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="rounded bg-black/40 px-3 py-1 text-xs text-white">
          {connected ? 'Online' : 'Connecting...'}
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

      {matrixRequired && pickMode && joined ? (
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
