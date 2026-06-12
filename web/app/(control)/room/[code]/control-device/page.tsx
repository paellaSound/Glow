'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Users, LogOut, Radio, HelpCircle } from 'lucide-react';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { DeviceList } from '@/components/glow/device-list';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import {
  PatternSequenceEditor,
  toDistributionEffects,
} from '@/components/glow/pattern-sequence-editor';
import { VisualsTab, normalizeRigResponse, type VisualsWorkingState, type RigWithCues } from '@/components/glow/visuals-tab';
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

function ControlDeviceContent({ code }: { code: string }) {
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(true);
  const [initialSequenceDraft, setInitialSequenceDraft] = useState<PatternSequenceDraft>(createDefaultDraft());
  const [liveDraftName, setLiveDraftName] = useState<string | null>(null);
  const [presetSeed, setPresetSeed] = useState(() => Date.now());
  const [fallbackSeed, setFallbackSeed] = useState(() => Date.now());

  const tabRaw = searchParams.get('tab');
  const normalizedTab: ActiveTab = tabRaw === 'visuals' ? 'visuals' : 'patterns';
  const [activeTab, setActiveTab] = useState<ActiveTab>(normalizedTab);

  const [workingState, setWorkingState] = useState<VisualsWorkingState>({
    mode: 'standard',
    artId: 'audio-shader',
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
    if (!roomState || rigLoaded.current) return;

    async function loadRig() {
      rigLoaded.current = true;
      try {
        const res = await fetch('/api/rigs');
        if (!res.ok) return;
        const rigs: RigWithCues[] = ((await res.json()) as unknown[]).map(normalizeRigResponse);
        if (!rigs.length) return;

        const rig = rigs.find((r) => r.is_default) ?? rigs[0];
        if (!rig) return;

        setLoadedRig(rig);
        const rigPalette =
          Array.isArray(rig.palette) && rig.palette.length > 0
            ? rig.palette
            : ['#FF0055', '#00FFCC'];

        setInitialSequenceDraft(createDefaultDraft(rigPalette));
        setWorkingState((prev) => ({
          ...prev,
          artId: rig.default_visual_art_id || 'audio-shader',
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
        router.push(`/auth/signin?redirect=/room/${code}/control-device`);
        return;
      }

      try {
        const res = await emitWithCallback<{ ok: boolean; error?: string }>('orchestrator:rejoin_room', {
          roomCode: code.toUpperCase(),
          accessToken: session.access_token,
        });
        if (res && res.error) {
          if (res.error === 'Unauthorized') {
            router.push(`/auth/signin?redirect=/room/${code}/control-device`);
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

  return (
    <LiveCallDeskProvider
      roomCode={code}
      roomState={roomState}
      entitlements={entitlements}
      socket={socket}
      connected={connected}
    >
      <main className="relative mx-auto max-w-lg px-4 py-4 min-h-screen pb-24 overflow-x-hidden">
        <SectionGlow glowColor="mixed" position="top" />

        <PageTransitionWrapper>
          {/* Header Mobile UI */}
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <NeonTitle as="h1" color="cyan" className="text-xl font-black tracking-widest">
                  ROOM {code.toUpperCase()}
                </NeonTitle>
                <div className="mt-1 flex items-center gap-1 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                  <span className={cn("inline-block size-1.5 rounded-full", connected ? "bg-neon-cyan" : "bg-zinc-500")} />
                  <span>{connected ? 'Live' : 'Connecting...'}</span>
                  <span>·</span>
                  <Users className="size-3 text-neon-cyan" />
                  <span>{roomState?.devices.length ?? 0} Players</span>
                </div>
              </div>

              <NeonButton
                color="magenta"
                variant="outline"
                className="h-10 px-3 text-xs uppercase tracking-widest border-red-500/20 text-red-400"
                onClick={() => setShowExitConfirm(true)}
              >
                <LogOut className="size-4 mr-1" />
                End
              </NeonButton>
            </div>

            {/* Custom Tab Switcher - Large Targets */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/15 bg-black/50 p-1">
              <button
                type="button"
                onClick={() => switchTab('patterns')}
                className={cn(
                  'rounded-lg py-3 text-xs font-cyber uppercase tracking-widest transition-all text-center',
                  activeTab === 'patterns'
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-inner'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Devices
              </button>
              <button
                type="button"
                onClick={() => switchTab('visuals')}
                className={cn(
                  'rounded-lg py-3 text-xs font-cyber uppercase tracking-widest transition-all text-center',
                  activeTab === 'visuals'
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-inner'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Visuals
              </button>
            </div>
          </div>

          {/* Confirm End Session Dialog */}
          {showExitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <NeonCard glowColor="magenta" borderVariant="magenta" className="p-6 max-w-sm w-full">
                <NeonTitle as="h3" color="magenta" className="text-lg font-black tracking-wider text-center">
                  End Live Session?
                </NeonTitle>
                <p className="mt-3 text-sm text-center text-zinc-300">
                  This will close the room for all players and surfaces. This action cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <NeonButton
                    color="magenta"
                    variant="solid"
                    className="flex-1 text-xs uppercase tracking-widest h-10"
                    disabled={closingRoom}
                    onClick={() => void handleCloseRoom()}
                  >
                    {closingRoom ? 'Closing...' : 'Yes, End Session'}
                  </NeonButton>
                  <NeonButton
                    color="cyan"
                    variant="outline"
                    className="flex-1 text-xs uppercase tracking-widest h-10"
                    onClick={() => setShowExitConfirm(false)}
                  >
                    Cancel
                  </NeonButton>
                </div>
              </NeonCard>
            </div>
          )}

          {/* Tab Content: Devices */}
          {activeTab === 'patterns' && (
            <div className="flex flex-col gap-4">
              <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-4">
                <div className="mb-3">
                  <NeonTitle as="h2" color="violet" className="text-base font-black tracking-widest">
                    Rave Patterns
                  </NeonTitle>
                  <p className="mt-0.5 text-[10px] text-muted-foreground uppercase">
                    Pick a sequence to broadcast live. Adjust effects in real time.
                  </p>
                </div>

                <PatternSequenceEditor
                  key={loadedRig?.id ?? 'default'}
                  variant="control"
                  mode="operate"
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

              {roomState && (
                <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-4">
                  <TorchControls
                    roomCode={code}
                    roomState={roomState}
                    socket={socket}
                    disabled={!connected}
                  />
                </NeonCard>
              )}

              {/* Connected Players Toggle list */}
              <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setDevicesOpen((value) => !value)}
                >
                  <div>
                    <NeonTitle as="h3" color="white" className="text-sm font-black tracking-widest">
                      CONNECTED SCREENS
                    </NeonTitle>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {roomState?.devices.length ?? 0} / {entitlements.maxDevices} devices online
                    </p>
                  </div>
                  {devicesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {devicesOpen && roomState && (
                  <div className="border-t border-white/10 px-4 pb-4">
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
                )}
              </NeonCard>

              {roomHasMatrix && roomState && (
                <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-4">
                  <NeonTitle as="h3" color="cyan" className="mb-3 text-sm font-black tracking-widest">
                    Grid Matrix
                  </NeonTitle>
                  <MatrixPanel
                    roomState={roomState}
                    selectedCell={selectedCell}
                    onCellClick={(row, col) => setSelectedCell({ row, col })}
                  />
                </NeonCard>
              )}
            </div>
          )}

          {/* Tab Content: Visuals */}
          {activeTab === 'visuals' && (
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
              mode="operate"
            />
          )}

        </PageTransitionWrapper>
      </main>
    </LiveCallDeskProvider>
  );
}

export default function ControlDevicePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-6 text-center text-zinc-500">Loading control console...</main>}>
      <ControlDeviceContent code={code} />
    </Suspense>
  );
}
