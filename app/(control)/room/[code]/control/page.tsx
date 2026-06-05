'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorPad } from '@/components/glow/color-pad';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import { useGlowSocket } from '@/lib/glow/socket';
import { PRESET_LABELS } from '@/lib/glow/presets';
import { createClient } from '@/lib/supabase/client';

export default function ControlPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { connected, roomState, emitWithCallback, socket } = useGlowSocket();
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [shareMatrixEnabled, setShareMatrixEnabled] = useState(false);
  const [colorHint, setColorHint] = useState<string | null>(null);

  useEffect(() => {
    async function rejoin() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/sign-in?redirect=/room/${code}/control`);
        return;
      }

      await emitWithCallback('orchestrator:rejoin_room', { roomCode: code.toUpperCase() });
    }

    if (connected) {
      void rejoin();
    }
  }, [connected, code, emitWithCallback, router]);

  function sendColor(colorHex: string, row?: number, col?: number) {
    const roomCode = code.toUpperCase();
    const targetTimestamp = Date.now() + 100;

    if (!matrixEnabled) {
      socket.current?.emit('orchestrator:broadcast_color', {
        roomCode,
        colorHex,
        targetTimestamp,
      });
      return;
    }

    const targetRow = row ?? selectedCell?.row;
    const targetCol = col ?? selectedCell?.col;
    if (targetRow === undefined || targetCol === undefined) {
      setColorHint('Select a matrix cell first');
      window.setTimeout(() => setColorHint(null), 2500);
      return;
    }

    setColorHint(null);
    socket.current?.emit('orchestrator:set_cell_color', {
      roomCode,
      row: targetRow,
      col: targetCol,
      colorHex,
      targetTimestamp,
    });
  }

  function runPreset(presetId: string) {
    socket.current?.emit('orchestrator:run_preset', {
      roomCode: code.toUpperCase(),
      presetId,
      seedTimestamp: Date.now(),
      targetTimestamp: Date.now() + 100,
    });
  }

  function toggleFallback() {
    const enabled = !fallbackEnabled;
    setFallbackEnabled(enabled);
    socket.current?.emit('orchestrator:set_fallback_mode', {
      roomCode: code.toUpperCase(),
      enabled,
      seedTimestamp: Date.now(),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Room {code.toUpperCase()}</h1>
            <RoomShareControls
              roomCode={code}
              matrixEnabled={shareMatrixEnabled}
              onMatrixEnabledChange={setShareMatrixEnabled}
              compact
            />
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {connected ? 'Connected' : 'Connecting...'} · {roomState?.devices.length ?? 0} devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleFallback}>
            Fallback {fallbackEnabled ? 'On' : 'Off'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => socket.current?.emit('orchestrator:close_room', { roomCode: code.toUpperCase() })}
          >
            Close Room
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {matrixEnabled ? (
          <Card className="border-white/10 bg-zinc-900 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Matrix</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMatrixEnabled(false)}>
                Hide
              </Button>
            </CardHeader>
            <CardContent>
              {roomState ? (
                <MatrixPanel
                  roomState={roomState}
                  selectedCell={selectedCell}
                  onCellClick={(row, col) => {
                    setSelectedCell({ row, col });
                    sendColor('#FF0055', row, col);
                  }}
                />
              ) : (
                <p className="text-sm text-zinc-400">Waiting for room state...</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>Matrix</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-zinc-400">
                Matrix mode is off. Colors apply to all connected players.
              </p>
              <Button variant="outline" onClick={() => setMatrixEnabled(true)}>
                Enable matrix
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-6">
          {roomState ? (
            <DeviceList
              roomState={roomState}
              onIdentify={(publicId) =>
                socket.current?.emit('orchestrator:identify_device', {
                  roomCode: code.toUpperCase(),
                  devicePublicId: publicId,
                })
              }
            />
          ) : null}

          <Card className="border-white/10 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>Color Pad</CardTitle>
            </CardHeader>
            <CardContent>
              {colorHint ? <p className="mb-3 text-sm text-amber-300">{colorHint}</p> : null}
              <ColorPad onColor={(colorHex) => sendColor(colorHex)} />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>Presets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(roomState?.entitlements.availablePresets ?? ['solid', 'flash', 'pulse']).map(
                (presetId) => (
                  <Button key={presetId} variant="outline" onClick={() => runPreset(presetId)}>
                    {PRESET_LABELS[presetId] ?? presetId}
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
