'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorPad } from '@/components/glow/color-pad';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
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
    const targetRow = row ?? selectedCell?.row;
    const targetCol = col ?? selectedCell?.col;
    if (targetRow === undefined || targetCol === undefined) return;

    socket.current?.emit('orchestrator:set_cell_color', {
      roomCode: code.toUpperCase(),
      row: targetRow,
      col: targetCol,
      colorHex,
      targetTimestamp: Date.now() + 100,
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
        <div>
          <h1 className="text-2xl font-bold">Room {code.toUpperCase()}</h1>
          <p className="text-sm text-zinc-400">
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
        <Card className="border-white/10 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle>Matrix</CardTitle>
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
