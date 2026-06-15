'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { captureClientEvent } from '@/lib/posthog-client';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, EyeOff, Plus, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { DeviceCapBanner } from '@/components/glow/device-cap-banner';
import { DeviceList } from '@/components/glow/device-list';
import { FirstPartyOnboarding } from '@/components/glow/first-party-onboarding';
import { OnboardingDebugPanel } from '@/components/glow/onboarding-debug-panel';
import type { OnboardingStepId } from '@/lib/onboarding/constants';
import { MatrixPanel } from '@/components/glow/matrix-panel';
import { ControlHeader, type ActiveTab } from '@/components/glow/control-header';
import { PlayDevicesDesk, getPlayerChromeFromRig } from '@/components/glow/play-devices-desk';
import { RoomShareControls } from '@/components/glow/room-share-controls';
import type { ConsoleMode } from '@/lib/glow/console-mode';
import {
  getUserLogoLayer,
  playerChromeConfigsEqual,
  rigLogoPublicUrl,
  type PlayerChromeConfig,
} from '@/lib/glow/player-chrome-config';
import {
  PatternSequenceEditor,
  toDistributionEffects,
  type SequenceSelectionState,
} from '@/components/glow/pattern-sequence-editor';
import { VisualsTab, normalizeRigResponse, type VisualsWorkingState, type RigWithCues } from '@/components/glow/visuals-tab';
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

const PLAY_SECTIONS = [
  { id: 'preset-sequences', label: 'Patterns / Play Devices' },
  { id: 'torch-controls', label: 'Flash / Torch' },
  { id: 'connected-screens', label: 'Connected Screens' },
  { id: 'matrix-grid', label: 'Grid Matrix', when: 'matrix' as const },
] as const;

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

const PLAY_SECTION_IDS: string[] = PLAY_SECTIONS.map((section) => section.id);

function sequenceEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Known section ids in saved order, then any known ids missing from the saved order. */
function normalizePlayOrder(saved: string[] | undefined): string[] {
  const known = (saved ?? []).filter((id) => PLAY_SECTION_IDS.includes(id));
  const missing = PLAY_SECTION_IDS.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

function EditSectionChrome({
  mode,
  order,
  onHide,
  onMoveUp,
  onMoveDown,
  children,
}: {
  mode: ConsoleMode;
  order?: number;
  onHide: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
}) {
  if (mode !== 'edit') return <div style={{ order }}>{children}</div>;

  return (
    <div style={{ order }} className="overflow-hidden rounded-2xl border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label="Move section up"
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label="Move section down"
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="inline-flex items-center gap-1.5 text-[10px] font-cyber uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <EyeOff className="size-3.5" />
          Hide
        </button>
      </div>
      {children}
    </div>
  );
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
  const [previewDraft, setPreviewDraft] = useState<PatternSequenceDraft>(createDefaultDraft());
  const [seqSelect, setSeqSelect] = useState<SequenceSelectionState>({ options: [], selectedId: null });
  const [seqSignal, setSeqSignal] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const [liveDraftName, setLiveDraftName] = useState<string | null>(null);
  const [presetSeed, setPresetSeed] = useState(() => Date.now());
  const [fallbackSeed, setFallbackSeed] = useState(() => Date.now());
  const [mobileQrUrl, setMobileQrUrl] = useState<string | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [hasRunPreset, setHasRunPreset] = useState(false);
  const [shareAcknowledged, setShareAcknowledged] = useState(false);
  const [onboardingActiveStep, setOnboardingActiveStep] = useState<OnboardingStepId | null>(null);
  const [mode, setMode] = useState<ConsoleMode>('play');
  const [workingHidden, setWorkingHidden] = useState<string[]>([]);
  const [baselineHidden, setBaselineHidden] = useState<string[]>([]);
  const [workingOrder, setWorkingOrder] = useState<string[]>(() => normalizePlayOrder(undefined));
  const [baselineOrder, setBaselineOrder] = useState<string[]>(() => normalizePlayOrder(undefined));
  const [savingConfig, setSavingConfig] = useState(false);
  const [workingPlayerChrome, setWorkingPlayerChrome] = useState<PlayerChromeConfig>({});
  const [baselinePlayerChrome, setBaselinePlayerChrome] = useState<PlayerChromeConfig>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (onboardingActiveStep === 2) {
      setDevicesOpen(true);
    }
  }, [onboardingActiveStep]);

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
  const consoleConfig = useMemo(() => getConsoleConfig(loadedRig), [loadedRig]);
  const visibleTabs = consoleConfig.visibleTabs;
  const isHidden = useCallback(
    (buttonId: string) => workingHidden.includes(buttonId),
    [workingHidden]
  );
  const configDirty = useMemo(
    () =>
      !arraysEqual(workingHidden, baselineHidden) ||
      !sequenceEqual(workingOrder, baselineOrder) ||
      !playerChromeConfigsEqual(workingPlayerChrome, baselinePlayerChrome),
    [workingHidden, baselineHidden, workingOrder, baselineOrder, workingPlayerChrome, baselinePlayerChrome]
  );

  useEffect(() => {
    if (!loadedRig) return;
    const hidden = getConsoleConfig(loadedRig).hiddenButtons;
    const chrome = getPlayerChromeFromRig(loadedRig.console_config);
    const order = normalizePlayOrder((loadedRig.console_config as any)?.playSectionOrder);
    setWorkingHidden(hidden);
    setBaselineHidden(hidden);
    setWorkingPlayerChrome(chrome);
    setBaselinePlayerChrome(chrome);
    setWorkingOrder(order);
    setBaselineOrder(order);
  }, [loadedRig?.id]);

  function hideSection(sectionId: string) {
    setWorkingHidden((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
  }

  function showSection(sectionId: string) {
    setWorkingHidden((prev) => prev.filter((id) => id !== sectionId));
  }

  async function saveConsoleConfig(): Promise<boolean> {
    if (!loadedRig || savingConfig) return false;

    setSavingConfig(true);
    try {
      const res = await fetch(`/api/rigs/${loadedRig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consoleConfig: {
            ...loadedRig.console_config,
            hiddenButtons: workingHidden,
            playSectionOrder: workingOrder,
            playerChrome: workingPlayerChrome,
          },
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const updated = normalizeRigResponse(await res.json());
      setLoadedRig(updated);
      setBaselineHidden(workingHidden);
      setBaselineOrder(workingOrder);
      setBaselinePlayerChrome(workingPlayerChrome);
      toast.success('Configuration saved');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save configuration');
      return false;
    } finally {
      setSavingConfig(false);
    }
  }

  function enterEditMode() {
    setMode('edit');
  }

  async function doneEditMode() {
    if (configDirty) {
      const saved = await saveConsoleConfig();
      if (!saved) return;
    }
    setMode('play');
  }

  function discardEditMode() {
    setWorkingHidden(baselineHidden);
    setWorkingOrder(baselineOrder);
    setWorkingPlayerChrome(baselinePlayerChrome);
    setMode('play');
  }

  async function handlePlayerLogoUpload(file: File) {
    if (!loadedRig || uploadingLogo) return;
    if (!entitlements.customRigLogo) {
      toast.error('Custom rig logo requires a Venue plan or higher');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/rigs/${loadedRig.id}/logo`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const updated = normalizeRigResponse(await res.json());
      setLoadedRig(updated);
      setWorkingPlayerChrome((prev) => {
        const userLogo = getUserLogoLayer(prev);
        return {
          ...prev,
          layers: {
            ...prev.layers,
            userLogo: { ...userLogo, visible: true },
          },
        };
      });
      toast.success('Logo uploaded — drag it on the preview, then Save & done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  const roomHasMatrix = useMemo(() => {
    if (!roomState) return parseMatrixParam(searchParams.get('matrix')) ?? false;
    return roomState.matrix.rows > 1 || roomState.matrix.cols > 1;
  }, [roomState, searchParams]);

  const hiddenPlaySections = useMemo(
    () =>
      PLAY_SECTIONS.filter((section) => {
        if ('when' in section && section.when === 'matrix' && !roomHasMatrix) return false;
        return isHidden(section.id);
      }),
    [isHidden, roomHasMatrix]
  );

  const hasSectionContent = useCallback(
    (id: string): boolean => {
      if (id === 'torch-controls') return Boolean(roomState);
      if (id === 'matrix-grid') return roomHasMatrix && Boolean(roomState);
      return true;
    },
    [roomState, roomHasMatrix]
  );

  const effectiveOrder = useMemo(() => normalizePlayOrder(workingOrder), [workingOrder]);

  const visibleSectionIds = useMemo(
    () => effectiveOrder.filter((id) => !isHidden(id) && hasSectionContent(id)),
    [effectiveOrder, isHidden, hasSectionContent]
  );

  function moveSection(id: string, dir: -1 | 1) {
    setWorkingOrder((prev) => {
      const order = normalizePlayOrder(prev);
      const visible = order.filter((sid) => !isHidden(sid) && hasSectionContent(sid));
      const vi = visible.indexOf(id);
      const target = vi + dir;
      if (vi < 0 || target < 0 || target >= visible.length) return prev;
      const swapId = visible[target]!;
      const next = [...order];
      const a = next.indexOf(id);
      const b = next.indexOf(swapId);
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });
  }

  function sectionChromeProps(id: string) {
    const visibleIndex = visibleSectionIds.indexOf(id);
    const lastIndex = visibleSectionIds.length - 1;
    return {
      order: effectiveOrder.indexOf(id),
      onHide: () => hideSection(id),
      onMoveUp: visibleIndex > 0 ? () => moveSection(id, -1) : undefined,
      onMoveDown:
        visibleIndex >= 0 && visibleIndex < lastIndex ? () => moveSection(id, 1) : undefined,
    };
  }

  const previewBackgroundColor = initialSequenceDraft.palette[0] ?? '#1a0533';

  const sequenceSelector =
    seqSelect.options.length > 0 ? (
      <select
        aria-label="Pattern sequence"
        value={seqSelect.selectedId ?? ''}
        disabled={!connected}
        onChange={(event) => setSeqSignal({ id: event.target.value, nonce: Date.now() })}
        className="h-9 max-w-[14rem] rounded-md border border-white/10 bg-black/40 px-2 text-xs font-cyber uppercase tracking-wider text-foreground"
      >
        {seqSelect.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
    ) : null;

  const pathname = usePathname();
  const { teamEntitlements, mutate: mutateEntitlements } = useTeamEntitlements();
  const entitlements = mergeEntitlementsForUi(roomState?.entitlements, teamEntitlements);
  const rigLogoUrlForPreview = useMemo(() => {
    if (!loadedRig?.logo_asset_path || !entitlements.customRigLogo) return null;
    return rigLogoPublicUrl(loadedRig.logo_asset_path);
  }, [loadedRig?.logo_asset_path, entitlements.customRigLogo]);
  const controlReturnUrl = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (onboardingActiveStep === 3 && activeTab !== 'patterns') {
      switchTab('patterns');
    }
  }, [onboardingActiveStep, activeTab]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? 'patterns');
    }
  }, [activeTab, visibleTabs.join(',')]);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      void mutateEntitlements();
      const params = new URLSearchParams(searchParams.toString());
      params.delete('checkout');
      const next = params.toString();
      router.replace(next ? `?${next}` : pathname, { scroll: false });
    }
  }, [searchParams, mutateEntitlements, router, pathname]);

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
        setPreviewDraft(createDefaultDraft(rigPalette));
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
        setHasRunPreset(true);
        captureClientEvent('pattern_sent_live', {
          room_code: code.toUpperCase(),
          sequence_name: draft.name,
          effect_count: effects.length,
          device_count: roomState?.devices.length ?? 0,
        });
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

    captureClientEvent('room_ended', {
      room_code: code.toUpperCase(),
      device_count: roomState?.devices.length ?? 0,
    });

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
          <ControlHeader
            roomCode={code}
            connected={connected}
            deviceCount={roomState?.devices.length ?? 0}
            mode={mode}
            onEnterEdit={enterEditMode}
            onDoneEdit={() => void doneEditMode()}
            onDiscardEdit={discardEditMode}
            configDirty={configDirty}
            savingConfig={savingConfig}
            visibleTabs={visibleTabs}
            activeTab={activeTab}
            onTabChange={switchTab}
            onOpenPhoneMode={() => setShowMobileModal(true)}
            onEndSession={() => void handleCloseRoom()}
            endingSession={closingRoom}
            showEndButton={!isHidden('terminate-rave')}
            sequenceSelector={sequenceSelector}
            shareControls={
              <RoomShareControls
                roomCode={code}
                matrixEnabled={shareMatrixEnabled}
                onMatrixEnabledChange={setShareMatrixEnabled}
                showMatrixOption={roomHasMatrix}
                compact
                onShareAction={() => setShareAcknowledged(true)}
              />
            }
          />

          {activeTab === 'patterns' && visibleTabs.includes('patterns') ? (
            <PlayDevicesDesk
              roomCode={code}
              mode={mode}
              previewBackgroundColor={previewBackgroundColor}
              playerChrome={workingPlayerChrome}
              entitlements={entitlements}
              logoUrl={rigLogoUrlForPreview}
              previewDraft={previewDraft}
              uploadingLogo={uploadingLogo}
              onLogoUpload={(file) => void handlePlayerLogoUpload(file)}
              onEnterEditLayout={enterEditMode}
              onPlayerChromeChange={setWorkingPlayerChrome}
            >
            <div className="flex flex-col gap-6">
              {mode === 'edit' && hiddenPlaySections.length > 0 ? (
                <div style={{ order: -2 }}>
                  <h3 className="mb-2 text-xs font-cyber font-bold uppercase tracking-widest text-zinc-400">
                    Operator panels
                  </h3>
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-cyber uppercase tracking-wider text-muted-foreground">
                    <Plus className="size-3.5" />
                    Add section
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hiddenPlaySections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => showSection(section.id)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-cyber uppercase tracking-wider text-zinc-300 transition-colors hover:border-neon-violet/30 hover:text-neon-violet"
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
              ) : null}

              {!isHidden('preset-sequences') ? (
                <EditSectionChrome mode={mode} {...sectionChromeProps('preset-sequences')}>
                  <NeonCard
                    glowColor="violet"
                    borderVariant="violet"
                    hoverEffect={false}
                    className={cn('p-5 sm:p-6', mode === 'edit' && 'rounded-none border-0')}
                    data-onboarding="preset"
                  >
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
                    mode="operate"
                    availablePresetIds={entitlements.availablePresets}
                    audioReactive={entitlements.audioReactive}
                    effectLayering={entitlements.effectLayering}
                    maxPatternSequences={entitlements.maxPatternSequences}
                    disabled={!connected}
                    audioSource={audioSource}
                    onAudioSourceChange={setAudioSource}
                    initialDraft={initialSequenceDraft}
                    onPreviewChange={setPreviewDraft}
                    onSelectionStateChange={setSeqSelect}
                    externalSelect={seqSignal}
                    hideInlineSelector
                    onSendLive={(draft) => sendDistribution(draft, true)}
                    roomCode={code.toUpperCase()}
                    liveName={liveDraftName}
                    presetSeed={presetSeed}
                    fallbackEnabled={fallbackEnabled}
                    fallbackSeed={fallbackSeed}
                    roomState={roomState || undefined}
                  />
                </NeonCard>
                </EditSectionChrome>
              ) : null}

              {roomState && !isHidden('torch-controls') ? (
                <EditSectionChrome mode={mode} {...sectionChromeProps('torch-controls')}>
                  <NeonCard
                    glowColor="cyan"
                    borderVariant="cyan"
                    hoverEffect={false}
                    className={cn('p-5 sm:p-6', mode === 'edit' && 'rounded-none border-0')}
                  >
                    <TorchControls
                      roomCode={code}
                      roomState={roomState}
                      socket={socket}
                      disabled={!connected}
                    />
                  </NeonCard>
                </EditSectionChrome>
              ) : null}

              {roomState ? (
                <div style={{ order: -1 }}>
                  <DeviceCapBanner
                    deviceCount={roomState.devices.length}
                    maxDevices={entitlements.maxDevices}
                    returnUrl={controlReturnUrl}
                  />
                </div>
              ) : null}

              {!isHidden('connected-screens') ? (
                <EditSectionChrome mode={mode} {...sectionChromeProps('connected-screens')}>
                  <NeonCard
                    glowColor="none"
                    borderVariant="default"
                    hoverEffect={false}
                    className={cn('overflow-hidden', mode === 'edit' && 'rounded-none border-0')}
                    data-onboarding="devices"
                  >
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
                      showOnboardingHint={onboardingActiveStep !== null}
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
                </EditSectionChrome>
              ) : null}

              {roomHasMatrix && !isHidden('matrix-grid') && roomState ? (
                <EditSectionChrome mode={mode} {...sectionChromeProps('matrix-grid')}>
                  <NeonCard
                    glowColor="cyan"
                    borderVariant="cyan"
                    hoverEffect={false}
                    className={cn('p-5 sm:p-6', mode === 'edit' && 'rounded-none border-0')}
                  >
                  <NeonTitle as="h3" color="cyan" className="mb-4 text-base font-black tracking-widest">
                    Grid Matrix
                  </NeonTitle>
                  <MatrixPanel
                    roomState={roomState}
                    selectedCell={selectedCell}
                    onCellClick={(row, col) => setSelectedCell({ row, col })}
                  />
                </NeonCard>
                </EditSectionChrome>
              ) : null}
            </div>
            </PlayDevicesDesk>
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

          <OnboardingDebugPanel />

          <FirstPartyOnboarding
            roomCode={code}
            deviceCount={roomState?.devices.length ?? 0}
            hasRunPreset={hasRunPreset}
            visualsTabActive={activeTab === 'visuals'}
            shareAcknowledged={shareAcknowledged}
            onRequestVisualsTab={() => switchTab('visuals')}
            onActiveStepChange={setOnboardingActiveStep}
          />

          {/* Mobile Device Control QR Modal */}
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
                    Control from Device
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
