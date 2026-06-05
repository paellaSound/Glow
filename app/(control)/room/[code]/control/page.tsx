'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { ColorPad } from '@/components/glow/color-pad';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import { useGlowSocket } from '@/lib/glow/socket';
import { PRESET_LABELS } from '@/lib/glow/presets';
import { createClient } from '@/lib/supabase/client';

function ControlContent({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, roomState, emitWithCallback, socket } = useGlowSocket();
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [shareMatrixEnabled, setShareMatrixEnabled] = useState(false);
  const [colorHint, setColorHint] = useState<string | null>(null);
  const [matrixPrefApplied, setMatrixPrefApplied] = useState(false);

  useEffect(() => {
    const matrixParam = searchParams.get('matrix');
    if (matrixParam === null || matrixPrefApplied) return;

    const enabled = parseMatrixParam(matrixParam);
    setMatrixEnabled(enabled);
    setShareMatrixEnabled(enabled);
    setMatrixPrefApplied(true);
  }, [searchParams, matrixPrefApplied]);

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
    <main className="relative mx-auto max-w-6xl px-6 py-8 min-h-screen overflow-hidden">
      <SectionGlow glowColor="mixed" position="top" />

      <PageTransitionWrapper>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <NeonTitle as="h1" color="cyan" className="text-3xl font-black tracking-widest leading-none">
                ROOM {code.toUpperCase()}
              </NeonTitle>
              <RoomShareControls
                roomCode={code}
                matrixEnabled={shareMatrixEnabled}
                onMatrixEnabledChange={setShareMatrixEnabled}
                compact
              />
            </div>
            <p className="mt-2 text-xs font-cyber tracking-wider text-muted-foreground uppercase">
              STATUS: <span className={connected ? 'text-neon-cyan neon-text-cyan' : 'text-zinc-500'}>{connected ? 'ONLINE' : 'CONNECTING...'}</span> · {roomState?.devices.length ?? 0} GRID UNITS
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <NeonButton color="cyan" variant="outline" onClick={toggleFallback} className="h-9 text-xs uppercase tracking-widest px-4">
              Fallback {fallbackEnabled ? 'On' : 'Off'}
            </NeonButton>
            <NeonButton
              color="magenta"
              variant="outline"
              className="h-9 text-xs uppercase tracking-widest px-4 border-red-500/20 hover:border-red-500 text-red-500/90 hover:text-red-500"
              onClick={() => socket.current?.emit('orchestrator:close_room', { roomCode: code.toUpperCase() })}
            >
              Close Room
            </NeonButton>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {matrixEnabled ? (
            <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-6">
              <div className="flex flex-row items-center justify-between mb-6">
                <NeonTitle as="h3" color="cyan" className="text-lg font-black tracking-widest">
                  TACTILE MATRIX
                </NeonTitle>
                <NeonButton color="cyan" variant="ghost" className="h-7 px-3 text-[10px] uppercase tracking-wider" onClick={() => setMatrixEnabled(false)}>
                  Disable
                </NeonButton>
              </div>
              <div className="p-1 rounded-xl bg-black/20 border border-white/5">
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
                  <p className="text-xs font-cyber text-muted-foreground text-center py-6">Waiting for grid response...</p>
                )}
              </div>
            </NeonCard>
          ) : (
            <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-6 flex flex-col justify-between min-h-[200px]">
              <div className="mb-4">
                <NeonTitle as="h3" color="white" className="text-lg font-black tracking-widest">
                  TACTILE MATRIX
                </NeonTitle>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  Matrix mode is disabled. All active screen units are bound to global broad-frequency control.
                </p>
              </div>
              <NeonButton color="cyan" variant="solid" onClick={() => setMatrixEnabled(true)} className="w-full text-xs uppercase tracking-widest h-10 mt-4">
                Activate Matrix Grid
              </NeonButton>
            </NeonCard>
          )}

          <div className="flex flex-col gap-8">
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

            <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-6">
              <div className="mb-4">
                <NeonTitle as="h3" color="cyan" className="text-lg font-black tracking-widest">
                  COLOR FREQUENCY
                </NeonTitle>
              </div>
              {colorHint ? <p className="mb-3 text-xs font-cyber text-amber-300 tracking-wide uppercase">{colorHint}</p> : null}
              <ColorPad onColor={(colorHex) => sendColor(colorHex)} />
            </NeonCard>

            <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-6">
              <div className="mb-4">
                <NeonTitle as="h3" color="violet" className="text-lg font-black tracking-widest">
                  PRESET WAVES
                </NeonTitle>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {(roomState?.entitlements.availablePresets ?? ['solid', 'flash', 'pulse']).map(
                  (presetId) => (
                    <NeonButton
                      key={presetId}
                      color="violet"
                      variant="outline"
                      onClick={() => runPreset(presetId)}
                      className="text-xs uppercase tracking-widest px-4 py-1.5 h-9"
                    >
                      {PRESET_LABELS[presetId] ?? presetId}
                    </NeonButton>
                  )
                )}
              </div>
            </NeonCard>
          </div>
        </div>
      </PageTransitionWrapper>
    </main>
  );
}

export default function ControlPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6">Loading...</main>}>
      <ControlContent code={code} />
    </Suspense>
  );
}
