'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { ColorPaletteField } from '@/components/glow/color-palette-field';
import { ControlLivePreview } from '@/components/glow/control-live-preview';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import { PresetPicker } from '@/components/glow/preset-picker';
import { VisualsTab, type VisualsWorkingState, type RigWithCues } from '@/components/glow/visuals-tab';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import { useGlowSocket } from '@/lib/glow/socket';
import type { PresetId, PresetParams } from '@/lib/glow/types';
import { DEFAULT_ENTITLEMENTS } from '@/lib/entitlements-defaults';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type ActiveTab = 'devices' | 'visuals';

type RigConsoleConfig = {
  visibleTabs?: ActiveTab[];
  hiddenButtons?: string[];
};

function getConsoleConfig(rig: RigWithCues | null): Required<RigConsoleConfig> {
  const config = (rig?.console_config ?? {}) as RigConsoleConfig;
  return {
    visibleTabs: config.visibleTabs?.length ? config.visibleTabs : ['devices', 'visuals'],
    hiddenButtons: config.hiddenButtons ?? [],
  };
}

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
  const [devicePalette, setDevicePalette] = useState<string[]>(['#FF0055', '#00FFCC']);
  const [presetSeed, setPresetSeed] = useState(() => Date.now());
  const [fallbackSeed, setFallbackSeed] = useState(() => Date.now());

  // Tab state — persisted in URL (?tab=devices|visuals)
  const tabParam = (searchParams.get('tab') as ActiveTab | null) ?? 'devices';
  const [activeTab, setActiveTab] = useState<ActiveTab>(tabParam);

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Visuals working state
  const [workingState, setWorkingState] = useState<VisualsWorkingState>({
    artId: 'glow-branded',
    palette: ['#FF0055', '#00FFCC'],
    logoEnabled: false,
    cueIndex: 0,
    dirty: false,
    loadedRigId: null,
  });

  const [loadedRig, setLoadedRig] = useState<RigWithCues | null>(null);
  const rigLoaded = useRef(false);

  const orchestratorAudio = useAudioAnalyzer({ enabled: streamOrchestratorAudio });
  const consoleConfig = useMemo(() => getConsoleConfig(loadedRig), [loadedRig]);
  const visibleTabs = consoleConfig.visibleTabs;
  const isButtonHidden = (buttonId: string) => consoleConfig.hiddenButtons.includes(buttonId);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? 'devices');
    }
  }, [activeTab, visibleTabs.join(',')]);

  // ── Load rig on rejoin (once room state lands) ────────────────────────────

  useEffect(() => {
    if (!roomState || rigLoaded.current) return;

    async function loadRig() {
      rigLoaded.current = true;
      try {
        // Fetch all rigs and match the default / the one loaded for this room
        const res = await fetch('/api/rigs');
        if (!res.ok) return;
        const rigs: RigWithCues[] = await res.json();
        if (!rigs.length) return;

        // Prefer the default rig; fall back to the first one
        const rig = rigs.find((r: any) => r.is_default) ?? rigs[0];
        if (!rig) return;

        setLoadedRig(rig);
        const rigPalette = Array.isArray(rig.palette) && rig.palette.length > 0
          ? rig.palette
          : ['#FF0055', '#00FFCC'];
        setDevicePalette(rigPalette);
        setWorkingState((prev) => ({
          ...prev,
          artId: rig.default_visual_art_id || 'glow-branded',
          palette: rigPalette,
          logoEnabled: rig.logo_enabled ?? false,
          cueIndex: 0,
          dirty: false,
          loadedRigId: rig.id,
        }));
      } catch {
        // silently ignore — visual controls still work without a rig
      }
    }

    void loadRig();
  }, [roomState]);

  function patchWorkingState(patch: Partial<VisualsWorkingState>) {
    setWorkingState((prev) => ({ ...prev, ...patch }));
  }

  // ── Audio streaming ───────────────────────────────────────────────────────

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

  // ── Matrix pref from URL ──────────────────────────────────────────────────

  useEffect(() => {
    const matrixParam = searchParams.get('matrix');
    if (matrixParam === null || matrixPrefApplied) return;

    const enabled = parseMatrixParam(matrixParam);
    setMatrixEnabled(enabled);
    setShareMatrixEnabled(enabled);
    setMatrixPrefApplied(true);
  }, [searchParams, matrixPrefApplied]);

  // ── Rejoin room ───────────────────────────────────────────────────────────

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

  // ── Actions ───────────────────────────────────────────────────────────────

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
    const seedTimestamp = Date.now();
    const mergedParams: PresetParams = {
      ...params,
      palette: devicePalette,
    };

    setActivePresetId(presetId);
    setPresetSeed(seedTimestamp);
    setStreamOrchestratorAudio(
      presetId === 'audio' && mergedParams?.audioSource === 'orchestrator'
    );
    socket.current?.emit('orchestrator:run_preset', {
      roomCode: code.toUpperCase(),
      presetId,
      seedTimestamp,
      targetTimestamp: seedTimestamp + 100,
      params: mergedParams,
    });
  }

  function handleDevicePaletteChange(palette: string[]) {
    setDevicePalette(palette);

    if (!activePresetId || !connected) return;

    const seedTimestamp = Date.now();
    const mergedParams: PresetParams = {
      ...(activePresetId === 'audio' ? { audioSource } : {}),
      palette,
    };

    setPresetSeed(seedTimestamp);
    socket.current?.emit('orchestrator:run_preset', {
      roomCode: code.toUpperCase(),
      presetId: activePresetId,
      seedTimestamp,
      targetTimestamp: seedTimestamp + 100,
      params: mergedParams,
    });
  }

  function toggleFallback() {
    const enabled = !fallbackEnabled;
    const seedTimestamp = Date.now();
    setFallbackEnabled(enabled);
    setFallbackSeed(seedTimestamp);
    socket.current?.emit('orchestrator:set_fallback_mode', {
      roomCode: code.toUpperCase(),
      enabled,
      seedTimestamp,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-8 min-h-screen overflow-hidden">
      <SectionGlow glowColor="mixed" position="top" />

      <PageTransitionWrapper>
        <ControlLivePreview
          activeTab={activeTab}
          roomCode={code.toUpperCase()}
          activePresetId={activePresetId}
          presetSeed={presetSeed}
          devicePalette={devicePalette}
          fallbackEnabled={fallbackEnabled}
          fallbackSeed={fallbackSeed}
          artId={workingState.artId}
          visualPalette={workingState.palette}
          logoEnabled={workingState.logoEnabled}
          logoUrl={
            loadedRig?.logo_asset_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/rig-logos/${loadedRig.logo_asset_path}`
              : null
          }
        />

        {/* ── Room header — always visible above tabs ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
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
            {!isButtonHidden('auto-strobe') ? (
              <NeonButton color="cyan" variant="outline" onClick={toggleFallback} className="h-9 text-xs uppercase tracking-widest px-4">
                Auto-Strobe {fallbackEnabled ? 'On' : 'Off'}
              </NeonButton>
            ) : null}
            {!isButtonHidden('terminate-rave') ? (
              <NeonButton
                color="magenta"
                variant="outline"
                className="h-9 text-xs uppercase tracking-widest px-4 border-red-500/20 hover:border-red-500 text-red-500/90 hover:text-red-500"
                disabled={closingRoom}
                onClick={() => void handleCloseRoom()}
              >
                {closingRoom ? 'Closing...' : 'Terminate Rave'}
              </NeonButton>
            ) : null}
          </div>
        </div>

        {/* ── Tab switcher ── */}
        {visibleTabs.length > 1 ? (
          <div className="mb-6 flex gap-1 rounded-full border border-white/10 bg-black/20 p-1 w-fit">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                id={`tab-${tab}`}
                onClick={() => switchTab(tab)}
                className={cn(
                  'px-5 py-2 rounded-full text-xs font-cyber uppercase tracking-widest transition-all duration-200',
                  activeTab === tab
                    ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_12px_-2px_rgba(0,229,255,0.3)]'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Devices tab ── */}
        {activeTab === 'devices' && visibleTabs.includes('devices') && (
          <div className="grid gap-8 lg:grid-cols-2">
            {!isButtonHidden('matrix-grid') ? (
              matrixEnabled ? (
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
              )
            ) : null}

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

              {!isButtonHidden('preset-sequences') ? (
                <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-6">
                  <div className="mb-4">
                    <NeonTitle as="h3" color="violet" className="text-lg font-black tracking-widest">
                      RAVE PATTERN SEQUENCES
                    </NeonTitle>
                  </div>

                  <div className="mb-6">
                    <ColorPaletteField
                      palette={devicePalette}
                      onChange={handleDevicePaletteChange}
                      maxColors={12}
                      disabled={!connected}
                      label="Pattern Color Palette"
                      showGradientPreview
                    />
                    <p className="mt-2 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                      Each pattern cycles through your palette colors across devices.
                    </p>
                  </div>

                  <PresetPicker
                    availablePresetIds={
                      roomState?.entitlements.availablePresets ?? DEFAULT_ENTITLEMENTS.availablePresets
                    }
                    audioReactive={
                      roomState?.entitlements.audioReactive ?? DEFAULT_ENTITLEMENTS.audioReactive
                    }
                    audioSource={audioSource}
                    onAudioSourceChange={setAudioSource}
                    showAudioSource
                    activePresetId={activePresetId}
                    disabled={!connected}
                    onRun={runPreset}
                  />
                </NeonCard>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Visuals tab ── */}
        {activeTab === 'visuals' && visibleTabs.includes('visuals') && (
          <VisualsTab
            code={code}
            socket={socket}
            roomState={roomState}
            connected={connected}
            workingState={workingState}
            onWorkingStateChange={patchWorkingState}
            loadedRig={loadedRig}
          />
        )}
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
