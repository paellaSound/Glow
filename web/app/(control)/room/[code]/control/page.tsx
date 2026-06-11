'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import {
  PatternSequenceEditor,
  toDistributionEffects,
} from '@/components/glow/pattern-sequence-editor';
import { VisualsTab, type VisualsWorkingState, type RigWithCues } from '@/components/glow/visuals-tab';
import { MediaPanel } from '@/components/glow/media-panel';
import { TorchControls } from '@/components/glow/torch-controls';
import { ORCHESTRATOR_SCHEDULE_MS } from '@/lib/glow/orchestrator-delay';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import { useGlowSocket } from '@/lib/glow/socket';
import {
  createDefaultDraft,
  type PatternSequenceDraft,
} from '@/lib/glow/pattern-sequences';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LiveCallDeskProvider } from '@/lib/glow/use-live-call-desk';


type ActiveTab = 'patterns' | 'visuals';

type RigConsoleConfig = {
  visibleTabs?: Array<'patterns' | 'visuals' | 'devices'>;
  hiddenButtons?: string[];
};

function getConsoleConfig(rig: RigWithCues | null): { visibleTabs: ActiveTab[]; hiddenButtons: string[] } {
  const config = (rig?.console_config ?? {}) as RigConsoleConfig;
  return {
    visibleTabs: config.visibleTabs?.length
      ? (config.visibleTabs
          .map((tab) => (tab === 'devices' ? 'patterns' : tab))
          .filter((tab) => tab === 'patterns' || tab === 'visuals') as ActiveTab[])
      : ['patterns', 'visuals'],
    hiddenButtons: config.hiddenButtons ?? [],
  };
}

function ControlContent({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, roomState, emitWithCallback, socket, on } = useGlowSocket();
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [shareMatrixEnabled, setShareMatrixEnabled] = useState(false);
  const [matrixPrefApplied, setMatrixPrefApplied] = useState(false);
  const [audioSource, setAudioSource] = useState<'local' | 'orchestrator'>('local');
  const [streamOrchestratorAudio, setStreamOrchestratorAudio] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [initialSequenceDraft, setInitialSequenceDraft] = useState<PatternSequenceDraft>(createDefaultDraft());
  const [liveDraftName, setLiveDraftName] = useState<string | null>(null);
  const [presetSeed, setPresetSeed] = useState(() => Date.now());
  const [fallbackSeed, setFallbackSeed] = useState(() => Date.now());
  const [mobileQrUrl, setMobileQrUrl] = useState<string | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/room/${code.toLowerCase()}/control-device`;
      QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).then((dataUrl) => {
        setMobileQrUrl(dataUrl);
      });
    }
  }, [code]);

  const tabRaw = searchParams.get('tab');
  const normalizedTab: ActiveTab =
    tabRaw === 'visuals' ? 'visuals' : 'patterns';
  const [activeTab, setActiveTab] = useState<ActiveTab>(normalizedTab);

  const [workingState, setWorkingState] = useState<VisualsWorkingState>({
    artId: 'glow-branded',
    palette: ['#FF0055', '#00FFCC'],
    logoEnabled: false,
    cueIndex: 0,
    dirty: false,
    loadedRigId: null,
    displayName: 'Glow',
  });

  const [loadedRig, setLoadedRig] = useState<RigWithCues | null>(null);
  const rigLoaded = useRef(false);
  const orchestratorAudio = useAudioAnalyzer({ enabled: streamOrchestratorAudio });
  const consoleConfig = useMemo(() => getConsoleConfig(loadedRig), [loadedRig]);
  const visibleTabs = consoleConfig.visibleTabs;
  const isButtonHidden = (buttonId: string) => consoleConfig.hiddenButtons.includes(buttonId);

  const roomHasMatrix = useMemo(() => {
    if (!roomState) return parseMatrixParam(searchParams.get('matrix')) ?? false;
    return roomState.matrix.rows > 1 || roomState.matrix.cols > 1;
  }, [roomState, searchParams]);

  const { teamEntitlements } = useTeamEntitlements();
  const entitlements = mergeEntitlementsForUi(roomState?.entitlements, teamEntitlements);

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? 'patterns');
    }
  }, [activeTab, visibleTabs.join(',')]);

  useEffect(() => {
    if (!roomState || rigLoaded.current) return;

    async function loadRig() {
      rigLoaded.current = true;
      try {
        const res = await fetch('/api/rigs');
        if (!res.ok) return;
        const rigs: RigWithCues[] = await res.json();
        if (!rigs.length) return;

        const rig = rigs.find((r) => (r as RigWithCues & { is_default?: boolean }).is_default) ?? rigs[0];
        if (!rig) return;

        setLoadedRig(rig);
        const rigPalette =
          Array.isArray(rig.palette) && rig.palette.length > 0
            ? rig.palette
            : ['#FF0055', '#00FFCC'];

        setInitialSequenceDraft(createDefaultDraft(rigPalette));
        setWorkingState((prev) => ({
          ...prev,
          artId: rig.default_visual_art_id || 'glow-branded',
          palette: rigPalette,
          logoEnabled: rig.logo_enabled ?? false,
          cueIndex: 0,
          dirty: false,
          loadedRigId: rig.id,
          displayName: (rig.console_config as any)?.displayName || rig.name || 'Glow',
        }));
      } catch {
        // ignore
      }
    }

    void loadRig();
  }, [roomState]);

  useEffect(() => {
    if (!streamOrchestratorAudio || !connected) return;

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

      try {
        const res = await emitWithCallback<{ ok: boolean; error?: string }>('orchestrator:rejoin_room', {
          roomCode: code.toUpperCase(),
          accessToken: session.access_token,
        });
        if (res && res.error) {
          if (res.error === 'Unauthorized') {
            router.push(`/auth/signin?redirect=/room/${code}/control`);
          } else {
            router.push('/');
          }
        }
      } catch (err) {
        console.error('Failed to rejoin room:', err);
        router.push('/');
      }
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

  const sendDistribution = useCallback(
    (draft: PatternSequenceDraft, markLive = false) => {
      const seedTimestamp = Date.now();
      const effects = toDistributionEffects(draft.effects, draft.palette);
      setPresetSeed(seedTimestamp);
      setStreamOrchestratorAudio(
        effects.some(
          (effect) =>
            effect.presetId === 'audio' && effect.params?.audioSource === 'orchestrator'
        )
      );

      if (markLive) {
        setLiveDraftName(draft.name);
      }

      const targetTimestamp = seedTimestamp + ORCHESTRATOR_SCHEDULE_MS;
      socket.current?.emit('orchestrator:run_distribution', {
        roomCode: code.toUpperCase(),
        effects,
        seedTimestamp,
        targetTimestamp,
      });

      // Optional: mirror strobe screen effect with a synchronized torch pattern
      if (
        entitlements.deviceFlashControl &&
        effects.some((effect) => effect.presetId === 'strobe')
      ) {
        socket.current?.emit('orchestrator:set_torch', {
          roomCode: code.toUpperCase(),
          target: { kind: 'all' },
          command: { action: 'pattern', onMs: 125, offMs: 125, cycles: 40 },
          targetTimestamp,
        });
      }

      // Broadcast media overlays if present and active
      if (draft.media && draft.media.active) {
        const target = draft.media.target || { kind: 'all' };
        if (draft.media.kind === 'text') {
          socket.current?.emit('orchestrator:media_text', {
            roomCode: code.toUpperCase(),
            text: draft.media.text,
            mode: draft.media.mode,
            speed: draft.media.speed,
            colorHex: draft.media.colorHex,
            loop: draft.media.loop,
            fontSize: draft.media.fontSize,
            target,
          });
        } else if (draft.media.kind === 'gif') {
          socket.current?.emit('orchestrator:media_gif', {
            roomCode: code.toUpperCase(),
            slug: draft.media.gifSlug,
            url: draft.media.gifUrl,
            width: draft.media.gifWidth,
            height: draft.media.gifHeight,
            target,
          });
        }
      } else {
        // Send clear if no media is active
        socket.current?.emit('orchestrator:media_clear', {
          roomCode: code.toUpperCase(),
          target: { kind: 'all' },
        });
      }
    },
    [code, socket, entitlements.deviceFlashControl]
  );

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

  return (
    <LiveCallDeskProvider
      roomCode={code}
      roomState={roomState}
      entitlements={entitlements}
      socket={socket}
      connected={connected}
    >

      <main className="relative mx-auto max-w-6xl px-4 py-6 min-h-screen overflow-hidden sm:px-6">
        <SectionGlow glowColor="mixed" position="top" />

        <PageTransitionWrapper>
          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <NeonTitle as="h1" color="cyan" className="text-2xl font-black tracking-widest sm:text-3xl">
                  ROOM {code.toUpperCase()}
                </NeonTitle>
                <p className="mt-2 text-xs font-cyber uppercase tracking-wider text-muted-foreground">
                  Status:{' '}
                  <span className={connected ? 'text-neon-cyan' : 'text-zinc-500'}>
                    {connected ? 'Online' : 'Connecting...'}
                  </span>
                  {' · '}
                  {roomState?.devices.length ?? 0} active screens
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <RoomShareControls
                  roomCode={code}
                  matrixEnabled={shareMatrixEnabled}
                  onMatrixEnabledChange={setShareMatrixEnabled}
                  showMatrixOption={roomHasMatrix}
                  compact
                />
                <NeonButton
                  color="cyan"
                  variant="outline"
                  className="h-9 px-3 text-xs uppercase tracking-widest gap-1.5"
                  onClick={() => setShowMobileModal(true)}
                >
                  <Smartphone className="size-3.5" />
                  Phone Mode
                </NeonButton>
                {/* {!isButtonHidden('auto-strobe') ? (
                  <NeonButton
                    color="cyan"
                    variant="outline"
                    onClick={toggleFallback}
                    className="h-9 px-4 text-xs uppercase tracking-widest"
                  >
                    Auto-Strobe {fallbackEnabled ? 'On' : 'Off'}
                  </NeonButton>
                ) : null} */}
                {!isButtonHidden('terminate-rave') ? (
                  <NeonButton
                    color="magenta"
                    variant="outline"
                    className="h-9 px-4 text-xs uppercase tracking-widest border-red-500/20 text-red-400"
                    disabled={closingRoom}
                    onClick={() => void handleCloseRoom()}
                  >
                    {closingRoom ? 'Closing...' : 'End session'}
                  </NeonButton>
                ) : null}
              </div>
            </div>

            {visibleTabs.length > 1 ? (
              <div
                role="tablist"
                aria-label="Control desk sections"
                className={cn(
                  'grid gap-2 rounded-xl border border-white/10 bg-black/30 p-1 sm:max-w-md',
                  visibleTabs.length === 3
                    ? 'grid-cols-3'
                    : visibleTabs.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                )}
              >
                {visibleTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    id={`tab-${tab}`}
                    onClick={() => switchTab(tab)}
                    className={cn(
                      'rounded-lg px-4 py-2.5 text-xs font-cyber uppercase tracking-widest transition-all',
                      activeTab === tab
                        ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'
                        : 'text-zinc-500 hover:text-zinc-200'
                    )}
                  >
                    {tab === 'patterns' ? 'Play Devices' : 'Visuals'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {activeTab === 'patterns' && visibleTabs.includes('patterns') ? (
            <div className="flex flex-col gap-6">
              {!isButtonHidden('preset-sequences') ? (
                <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5 sm:p-6">
                  <div className="mb-5">
                    <NeonTitle as="h2" color="violet" className="text-lg font-black tracking-widest">
                      Rave Pattern Sequences
                    </NeonTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick a sequence to send live. Edit below and save to overwrite, or rename to add new.
                    </p>
                  </div>

                  <PatternSequenceEditor
                    key={loadedRig?.id ?? 'default'}
                    variant="control"
                    availablePresetIds={entitlements.availablePresets}
                    audioReactive={entitlements.audioReactive}
                    effectLayering={entitlements.effectLayering}
                    maxPatternSequences={entitlements.maxPatternSequences}
                    disabled={!connected}
                    audioSource={audioSource}
                    onAudioSourceChange={setAudioSource}
                    initialDraft={initialSequenceDraft}
                    onSendLive={(draft) => sendDistribution(draft, true)}
                    roomCode={code.toUpperCase()}
                    liveName={liveDraftName}
                    presetSeed={presetSeed}
                    fallbackEnabled={fallbackEnabled}
                    fallbackSeed={fallbackSeed}
                    roomState={roomState || undefined}
                  />
                </NeonCard>
              ) : null}

              {roomState ? (
                <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5 sm:p-6">
                  <TorchControls
                    roomCode={code}
                    roomState={roomState}
                    socket={socket}
                    disabled={!connected}
                  />
                </NeonCard>
              ) : null}

              <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setDevicesOpen((value) => !value)}
                >
                  <div>
                    <NeonTitle as="h3" color="white" className="text-base font-black tracking-widest">
                      Connected Screens
                    </NeonTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {roomState?.devices.length ?? 0} / {entitlements.maxDevices} devices online
                    </p>
                  </div>
                  {devicesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {devicesOpen && roomState ? (
                  <div className="border-t border-white/10 px-5 pb-5">
                    <DeviceList
                      roomState={roomState}
                      onIdentify={(publicId) =>
                        socket.current?.emit('orchestrator:identify_device', {
                          roomCode: code.toUpperCase(),
                          devicePublicId: publicId,
                        })
                      }
                    />
                  </div>
                ) : null}
              </NeonCard>

              {roomHasMatrix && !isButtonHidden('matrix-grid') && roomState ? (
                <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5 sm:p-6">
                  <NeonTitle as="h3" color="cyan" className="mb-4 text-base font-black tracking-widest">
                    Grid Matrix
                  </NeonTitle>
                  <MatrixPanel
                    roomState={roomState}
                    selectedCell={selectedCell}
                    onCellClick={(row, col) => setSelectedCell({ row, col })}
                  />
                </NeonCard>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'visuals' && visibleTabs.includes('visuals') ? (
            <VisualsTab
              code={code}
              socket={socket}
              roomState={roomState}
              connected={connected}
              workingState={workingState}
              onWorkingStateChange={(patch) =>
                setWorkingState((prev) => ({ ...prev, ...patch }))
              }
              loadedRig={loadedRig}
            />
          ) : null}


          {/* Mobile Phone Control QR Modal */}
          {showMobileModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <NeonCard glowColor="cyan" borderVariant="cyan" className="p-6 max-w-sm w-full relative">
                <button
                  type="button"
                  className="absolute top-4 right-4 text-zinc-400 hover:text-white text-sm"
                  onClick={() => setShowMobileModal(false)}
                >
                  ✕
                </button>
                <div className="text-center">
                  <Smartphone className="size-8 mx-auto text-neon-cyan mb-2" />
                  <NeonTitle as="h3" color="cyan" className="text-lg font-black tracking-wider uppercase">
                    Control from Phone
                  </NeonTitle>
                  <p className="mt-2 text-xs text-zinc-400">
                    Scan this QR code to load the operate-only interface on your mobile or tablet.
                  </p>

                  <div className="my-5 flex justify-center">
                    {mobileQrUrl ? (
                      <div className="bg-white p-2 rounded-xl">
                        <img
                          src={mobileQrUrl}
                          alt="Mobile Control QR"
                          className="size-48"
                        />
                      </div>
                    ) : (
                      <div className="size-48 flex items-center justify-center text-xs text-zinc-500 font-cyber animate-pulse">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-zinc-500 break-all select-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/room/${code.toLowerCase()}/control-device` : ''}
                  </p>

                  <NeonButton
                    color="cyan"
                    variant="solid"
                    className="mt-6 w-full text-xs uppercase tracking-widest h-10"
                    onClick={() => setShowMobileModal(false)}
                  >
                    Got it
                  </NeonButton>
                </div>
              </NeonCard>
            </div>
          )}

        </PageTransitionWrapper>
      </main>
    </LiveCallDeskProvider>
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
