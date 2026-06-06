'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { ColorPad } from '@/components/glow/color-pad';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import { PresetPicker } from '@/components/glow/preset-picker';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import { useGlowSocket } from '@/lib/glow/socket';
import type { PresetId, PresetParams } from '@/lib/glow/types';
import { createClient } from '@/lib/supabase/client';

function ControlContent({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, roomState, emitWithCallback, socket, on } = useGlowSocket();
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [shareMatrixEnabled, setShareMatrixEnabled] = useState(false);
  const [colorHint, setColorHint] = useState<string | null>(null);
  const [matrixPrefApplied, setMatrixPrefApplied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<'local' | 'orchestrator'>('local');
  const [streamOrchestratorAudio, setStreamOrchestratorAudio] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);

  const orchestratorAudio = useAudioAnalyzer({ enabled: streamOrchestratorAudio });

  useEffect(() => {
    if (!streamOrchestratorAudio || !connected) {
      return;
    }

    let rafId = 0;
    let lastEmit = 0;

    const tick = (now: number) => {
      if (now - lastEmit >= 33) {
        socket.current?.emit('orchestrator:audio_features', {
          roomCode: code.toUpperCase(),
          features: orchestratorAudio.featuresRef.current,
          timestamp: now,
        });
        lastEmit = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [streamOrchestratorAudio, connected, code, orchestratorAudio.featuresRef, socket]);

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
        router.push(`/auth/signin?redirect=/room/${code}/control`);
        return;
      }

      await emitWithCallback('orchestrator:rejoin_room', { roomCode: code.toUpperCase() });
    }

    if (connected) {
      void rejoin();
    }
  }, [connected, code, emitWithCallback, router]);

  useEffect(() => {
    const unsubscribe = on('room:closed', () => {
      setStreamOrchestratorAudio(false);
      router.push('/');
    });

    return unsubscribe;
  }, [on, router]);

  async function handleCloseRoom() {
    if (closingRoom) return;

    setClosingRoom(true);
    setStreamOrchestratorAudio(false);

    try {
      const response = await emitWithCallback<{ ok: boolean; reason?: string }>(
        'orchestrator:close_room',
        { roomCode: code.toUpperCase() }
      );

      if (!response.ok && response.reason !== 'Room not found') {
        alert(response.reason ?? 'Could not close room');
        setClosingRoom(false);
        return;
      }
    } catch {
      setClosingRoom(false);
      return;
    }

    router.push('/');
  }

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

  function runPreset(presetId: PresetId, params?: PresetParams) {
    setActivePresetId(presetId);
    setStreamOrchestratorAudio(
      presetId === 'audio' && params?.audioSource === 'orchestrator'
    );
    socket.current?.emit('orchestrator:run_preset', {
      roomCode: code.toUpperCase(),
      presetId,
      seedTimestamp: Date.now(),
      targetTimestamp: Date.now() + 100,
      params,
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
              STATUS: <span className={connected ? 'text-neon-cyan neon-text-cyan' : 'text-zinc-500'}>{connected ? 'ONLINE' : 'CONNECTING...'}</span> · {roomState?.devices.length ?? 0} ACTIVE SCREENS
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <NeonButton color="cyan" variant="outline" onClick={toggleFallback} className="h-9 text-xs uppercase tracking-widest px-4">
              Auto-Strobe {fallbackEnabled ? 'On' : 'Off'}
            </NeonButton>
            <NeonButton
              color="magenta"
              variant="outline"
              className="h-9 text-xs uppercase tracking-widest px-4 border-red-500/20 hover:border-red-500 text-red-500/90 hover:text-red-500"
              disabled={closingRoom}
              onClick={() => void handleCloseRoom()}
            >
              {closingRoom ? 'Closing...' : 'Terminate Rave'}
            </NeonButton>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {matrixEnabled ? (
            <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-6">
              <div className="flex flex-row items-center justify-between mb-6">
                <NeonTitle as="h3" color="cyan" className="text-lg font-black tracking-widest">
                  STAGED GRID MATRIX
                </NeonTitle>
                <NeonButton color="cyan" variant="ghost" className="h-7 px-3 text-[10px] uppercase tracking-wider" onClick={() => setMatrixEnabled(false)}>
                  Offline
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
                  STAGED GRID MATRIX
                </NeonTitle>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  Grid matrix is offline. All synced devices are firing strobe flashes in global harmony.
                </p>
              </div>
              <NeonButton color="cyan" variant="solid" onClick={() => setMatrixEnabled(true)} className="w-full text-xs uppercase tracking-widest h-10 mt-4">
                BOOST TO GRID MATRIX
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
                  BEAT FREQUENCY COLORS
                </NeonTitle>
              </div>
              {colorHint ? <p className="mb-3 text-xs font-cyber text-amber-300 tracking-wide uppercase">{colorHint}</p> : null}
              <ColorPad onColor={(colorHex) => sendColor(colorHex)} />
            </NeonCard>

            <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-6">
              <div className="mb-4">
                <NeonTitle as="h3" color="violet" className="text-lg font-black tracking-widest">
                  RAVE PATTERN SEQUENCES
                </NeonTitle>
              </div>
              <PresetPicker
                availablePresetIds={
                  roomState?.entitlements.availablePresets ?? ['solid', 'flash', 'pulse']
                }
                audioReactive={roomState?.entitlements.audioReactive ?? false}
                audioSource={audioSource}
                onAudioSourceChange={setAudioSource}
                showAudioSource
                activePresetId={activePresetId}
                disabled={!connected}
                onRun={runPreset}
              />
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
