'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Monitor,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { PaletteEditor } from '@/components/glow/palette-editor';
// import { CueList, type RigCue } from '@/components/glow/cue-list';
import type { RigCue } from '@/components/glow/cue-list';
import type { Socket } from 'socket.io-client';
import type { RoomStatePayload, VisualsMode, YoutubeQueueItem, YoutubeTransitionEffect } from '@/lib/glow/types';
import { VISUAL_ART_REGISTRY, type AudioFeatures } from 'glow-visuals';
import { LiveCallControls } from '@/components/glow/live-call-controls';
import { PlanGate, PlanGateUpsell } from '@/components/glow/plan-gate';
import { GlowLogo } from '@/components/glow/glow-logo';
import {
  buildDefaultGlowSurfaceLogo,
  GLOW_BRAND_NAME,
} from '@/lib/glow/branding';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import {
  canEmitVisualsMode,
  isUnlimitedEmitSlots,
} from '@/lib/plans/freemium-depth';
import { cn } from '@/lib/utils';
import { VisualsPreview } from '@/components/glow/visuals-preview';
import { EditSectionChrome } from '@/components/glow/edit-section-chrome';
import { ResizableTwoColumn } from '@/components/glow/resizable-two-column';
import type { ConsoleMode } from '@/lib/glow/console-mode';
import { parseYoutubeVideoId } from '@/lib/youtube';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Types ──────────────────────────────────────────────────────────────────

export type VisualsWorkingState = {
  mode: VisualsMode;
  artId: string;
  palette: string[];
  logoEnabled: boolean;
  cueIndex: number;
  dirty: boolean;
  loadedRigId: string | null;
  displayName?: string;
  micEnabled?: boolean;
};

export type RigWithCues = {
  id: string;
  name: string;
  default_visual_art_id: string;
  palette: string[];
  logo_asset_path: string | null;
  logo_enabled: boolean;
  console_config: Record<string, unknown>;
  is_default?: boolean;
  cues: RigCue[];
};

/**
 * GET /api/rigs returns drizzle camelCase rows (logoAssetPath, consoleConfig…)
 * while the desk works with the snake_case RigWithCues shape. Without this
 * mapping the desk silently loses the logo, console config and default art.
 */
export function normalizeRigResponse(raw: any): RigWithCues {
  return {
    id: raw.id,
    name: raw.name,
    default_visual_art_id: raw.defaultVisualArtId ?? raw.default_visual_art_id ?? '',
    palette: Array.isArray(raw.palette) ? raw.palette : [],
    logo_asset_path: raw.logoAssetPath ?? raw.logo_asset_path ?? null,
    logo_enabled: raw.logoEnabled ?? raw.logo_enabled ?? false,
    console_config: raw.consoleConfig ?? raw.console_config ?? {},
    is_default: raw.isDefault ?? raw.is_default ?? false,
    cues: Array.isArray(raw.cues)
      ? raw.cues.map((c: any) => ({
        id: c.id,
        visualArtId: c.visualArtId ?? c.visual_art_id,
        sortOrder: c.sortOrder ?? c.sort_order ?? 0,
        params: c.params ?? undefined,
        transition: c.transition ?? undefined,
        label: c.label ?? undefined,
      }))
      : [],
  };
}

interface VisualsTabProps {
  code: string;
  socket: React.MutableRefObject<Socket | null>;
  roomState: RoomStatePayload | null;
  connected: boolean;
  workingState: VisualsWorkingState;
  onWorkingStateChange: (patch: Partial<VisualsWorkingState>) => void;
  loadedRig: RigWithCues | null;
  onLoadedRigChange?: (rig: RigWithCues) => void;
  mode?: ConsoleMode;
  surfaceConnected?: boolean;
  isSectionHidden?: (id: string) => boolean;
  sectionChromeProps?: (id: string) => {
    order?: number;
    onHide: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
  };
  hiddenSections?: { id: string; label: string }[];
  onShowSection?: (id: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function rigLogoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/rig-logos/${path}`;
}

// ── Visuals modes ──────────────────────────────────────────────────────────

const VISUALS_MODES: { id: VisualsMode; label: string; description: string; implemented: boolean }[] = [
  { id: 'standard', label: 'Standard', description: 'Palette-driven audio-reactive arts', implemented: true },
  { id: 'youtube', label: 'YouTube', description: 'Fullscreen YouTube video with overlays on top', implemented: true },
  { id: 'custom-video', label: 'Custom Video', description: 'Your own clip sequence with transitions', implemented: false },
  { id: '3d', label: '3D Visuals', description: 'Music-reactive 3D scenes with energy levels', implemented: false },
  { id: 'pptt', label: 'PPTT Mode', description: 'Google Slides presentation with live QR', implemented: false },
];

// ── YouTube transitions ────────────────────────────────────────────────────

const YT_TRANSITIONS: { id: YoutubeTransitionEffect; label: string }[] = [
  { id: 'dip-black', label: 'Dip to black' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'pixel-melt', label: 'Pixel melt' },
];

// Same keyframes the surface uses, scoped to the desk preview chips
const YT_DESK_CSS = `
@keyframes yt-dip-black {
  0% { opacity: 0; } 25% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; }
}
@keyframes yt-glitch-shift {
  0% { transform: translate(0,0); clip-path: inset(0 0 85% 0); }
  20% { transform: translate(3px,-2px); clip-path: inset(60% 0 20% 0); }
  40% { transform: translate(-4px,1px); clip-path: inset(45% 0 35% 0); }
  60% { transform: translate(3px,-1px); clip-path: inset(20% 0 60% 0); }
  80% { transform: translate(-3px,2px); clip-path: inset(5% 0 80% 0); }
  100% { transform: translate(0,0); clip-path: inset(0 0 85% 0); }
}
@keyframes yt-pixel-melt {
  0% { filter: blur(0px); opacity: 0; }
  30% { filter: blur(6px); opacity: 1; }
  70% { filter: blur(6px); opacity: 1; }
  100% { filter: blur(0px); opacity: 0; }
}
`;

function YtTransitionPreview({ effect }: { effect: YoutubeTransitionEffect }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
        setTimeout(() => setPlaying(false), 1500);
      }}
      className="relative ml-auto h-6 w-12 overflow-hidden rounded border border-white/10 bg-gradient-to-r from-cyan-900/60 to-fuchsia-900/60"
      title="Preview transition"
      aria-label="Preview transition"
    >
      {playing && effect === 'dip-black' && (
        <span className="absolute inset-0 bg-black" style={{ animation: 'yt-dip-black 1.4s ease-in-out' }} />
      )}
      {playing && effect === 'glitch' && (
        <>
          <span className="absolute inset-0 bg-cyan-400/70 mix-blend-screen" style={{ animation: 'yt-glitch-shift 0.18s steps(2) infinite' }} />
          <span className="absolute inset-0 bg-fuchsia-500/70 mix-blend-screen" style={{ animation: 'yt-glitch-shift 0.22s steps(3) infinite reverse' }} />
        </>
      )}
      {playing && effect === 'pixel-melt' && (
        <span className="absolute inset-0 bg-black/70" style={{ animation: 'yt-pixel-melt 1.4s ease-in-out' }} />
      )}
      {!playing && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-cyber uppercase text-zinc-300">
          ▶
        </span>
      )}
    </button>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, color = 'cyan' }: { title: string; color?: 'cyan' | 'violet' | 'magenta' }) {
  return (
    <NeonTitle as="h3" color={color} className="text-xs font-cyber font-black tracking-widest leading-none">
      {title}
    </NeonTitle>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function VisualsTab({
  code,
  socket,
  roomState,
  connected,
  workingState,
  onWorkingStateChange,
  loadedRig,
  onLoadedRigChange,
  mode = 'play',
  surfaceConnected = false,
  isSectionHidden = () => false,
  sectionChromeProps = () => ({ onHide: () => { } }),
  hiddenSections = [],
  onShowSection = () => { },
}: VisualsTabProps) {
  const roomCode = code.toUpperCase();
  const editing = mode === 'edit';
  const contextualSectionOrder = (sectionChromeProps('visualsMode').order ?? 0) + 1;
  const { teamEntitlements } = useTeamEntitlements();
  const entitlements = mergeEntitlementsForUi(roomState?.entitlements, teamEntitlements);
  const hasVisualsSurface = entitlements.visualsSurface;

  // Surface vs desk preview (freemium depth)
  const [surfaceMode, setSurfaceMode] = useState<VisualsMode>('standard');
  const [emittedCounts, setEmittedCounts] = useState<Partial<Record<VisualsMode, number>>>({});
  const [emitError, setEmitError] = useState<string | null>(null);
  const [emittingMode, setEmittingMode] = useState(false);

  // Output section — share action lives on the Visuals tab in the header

  // Rig overwrite state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoRect, setLogoRect] = useState<{ x: number; y: number; width: number } | null>(null);
  const logoPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapsible cards state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    output: false,
    liveCall: false,
    // cues: false,
    visualsMode: false,
    art: false,
    audioInput: false,
    palette: false,
    showName: false,
    text: false,
    qr: false,
    rig: false,
  });

  // Live Text Overlay state
  const [textInput, setTextInput] = useState('');
  const [textMode, setTextMode] = useState<'marquee' | 'word_by_word' | 'spread_grid'>('marquee');
  const [textSpeed, setTextSpeed] = useState(5);
  const [textColorHex, setTextColorHex] = useState('#ffffff');
  const [textFontSize, setTextFontSize] = useState(72);
  const [textLoop, setTextLoop] = useState(true);
  const [activeTextOverlay, setActiveTextOverlay] = useState<{
    text: string;
    mode: 'marquee' | 'word_by_word' | 'spread_grid';
    speed: number;
    colorHex?: string;
    fontSize?: number;
    loop: boolean;
  } | null>(null);

  // Live QR Overlay state
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrInterval, setQrInterval] = useState(30);
  const [qrDuration, setQrDuration] = useState(10);
  const [qrPeriodic, setQrPeriodic] = useState(false);
  const [qrPosition, setQrPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('center');
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [activeQrConfig, setActiveQrConfig] = useState<{
    enabled: boolean;
    intervalSeconds: number;
    durationSeconds: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'small' | 'medium' | 'large';
  } | null>(null);

  // Load QR settings from loaded rig console_config
  useEffect(() => {
    if (loadedRig) {
      const namePos = (loadedRig.console_config as any)?.displayNameConfig?.position;
      if (namePos) setDisplayNamePosition(namePos);
      const savedRect = (loadedRig.console_config as any)?.logoConfig?.rect;
      setLogoRect(
        savedRect && typeof savedRect.x === 'number'
          ? { x: savedRect.x, y: savedRect.y, width: savedRect.width }
          : null
      );
      const cfg = (loadedRig.console_config as any)?.qrConfig;
      if (cfg) {
        setQrEnabled(cfg.enabled ?? false);
        setQrInterval(cfg.intervalSeconds ?? 30);
        setQrDuration(cfg.durationSeconds ?? 10);
        setQrPosition(cfg.position ?? 'center');
        setQrSize(cfg.size ?? 'medium');

        const isPeriodic = (cfg.intervalSeconds ?? 0) > 0 && (cfg.durationSeconds ?? 0) > 0;
        setQrPeriodic(isPeriodic);

        setActiveQrConfig({
          enabled: cfg.enabled ?? false,
          intervalSeconds: cfg.intervalSeconds ?? 30,
          durationSeconds: cfg.durationSeconds ?? 10,
          position: cfg.position ?? 'center',
          size: cfg.size ?? 'medium',
        });
      }
    }
  }, [loadedRig]);

  // Handle display name change
  const [displayNamePosition, setDisplayNamePosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('center');

  function handleDisplayNameChange(name: string) {
    onWorkingStateChange({ displayName: name, dirty: true });
    socket.current?.emit('orchestrator:visuals_set_display', {
      roomCode,
      displayName: name,
      displayNamePosition,
    });
  }

  function handleDisplayNamePosition(position: typeof displayNamePosition) {
    setDisplayNamePosition(position);
    socket.current?.emit('orchestrator:visuals_set_display', {
      roomCode,
      displayNamePosition: position,
    });
  }

  // Handle QR code overlay updates
  function handleQrUpdate(
    enabled: boolean,
    positionOverride?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    sizeOverride?: 'small' | 'medium' | 'large',
    intervalOverride?: number,
    durationOverride?: number
  ) {
    const activePosition = positionOverride !== undefined ? positionOverride : qrPosition;
    const activeSize = sizeOverride !== undefined ? sizeOverride : qrSize;

    const isPeriodic = intervalOverride !== undefined || durationOverride !== undefined
      ? ((intervalOverride ?? 0) > 0 && (durationOverride ?? 0) > 0)
      : qrPeriodic;

    const activeInterval = intervalOverride !== undefined
      ? intervalOverride
      : (isPeriodic ? qrInterval : 0);

    const activeDuration = durationOverride !== undefined
      ? durationOverride
      : (isPeriodic ? qrDuration : 0);

    const config = {
      enabled,
      position: activePosition,
      size: activeSize,
      intervalSeconds: activeInterval,
      durationSeconds: activeDuration,
    };

    socket.current?.emit('orchestrator:visuals_set_qr', {
      roomCode,
      qrConfig: config,
    });
    setActiveQrConfig(config);
  }

  // Handle QR periodic mode toggle
  function handleQrTogglePeriodic(periodic: boolean) {
    setQrPeriodic(periodic);
    const interval = periodic ? qrInterval : 0;
    const duration = periodic ? qrDuration : 0;
    handleQrUpdate(qrEnabled, qrPosition, qrSize, interval, duration);
  }

  // Handle sending custom live text
  function handleSendText() {
    if (!textInput.trim()) return;
    const payload = {
      roomCode,
      text: textInput,
      mode: textMode,
      speed: Number(textSpeed),
      colorHex: textColorHex,
      fontSize: Number(textFontSize),
      loop: textLoop,
    };
    socket.current?.emit('orchestrator:visuals_set_text', payload);
    setActiveTextOverlay(payload);
  }

  // Handle clearing live text
  function handleClearText() {
    socket.current?.emit('orchestrator:visuals_clear_text', { roomCode });
    setTextInput('');
    setActiveTextOverlay(null);
  }

  // ── Visuals surface share (Output section) ────────────────────────────────

  // Sync authoritative surface mode from server
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const onMode = (payload: { mode: VisualsMode }) => {
      if (payload.mode) setSurfaceMode(payload.mode);
    };
    s.on('visuals:mode', onMode);
    return () => {
      s.off('visuals:mode', onMode);
    };
  }, [socket, connected]);

  const previewingMode = workingState.mode !== surfaceMode;
  const emitSlots = entitlements.visualsEmitSlotsPerMode ?? 999;
  const showEmitSlots = !isUnlimitedEmitSlots(emitSlots);
  const currentEmitCheck = canEmitVisualsMode(entitlements, emittedCounts, workingState.mode);

  function canControlSurfaceForMode(mode: VisualsMode): boolean {
    return surfaceMode === mode;
  }

  // ── Visuals mode selector (desk preview only) ─────────────────────────────

  function handleModePreviewChange(mode: VisualsMode) {
    if (mode === workingState.mode) return;
    onWorkingStateChange({ mode, dirty: true });
    setEmitError(null);
  }

  function handleEmitModeToSurface() {
    const mode = workingState.mode;
    const check = canEmitVisualsMode(entitlements, emittedCounts, mode);
    if (!check.allowed) {
      setEmitError('Emit limit reached for this mode this session.');
      return;
    }
    if (mode === surfaceMode) return;

    setEmittingMode(true);
    setEmitError(null);
    socket.current?.emit(
      'orchestrator:visuals_set_mode',
      { roomCode, mode },
      (response: { ok: boolean; reason?: string }) => {
        setEmittingMode(false);
        if (response?.ok) {
          setSurfaceMode(mode);
          setEmittedCounts((prev) => ({
            ...prev,
            [mode]: (prev[mode] ?? 0) + 1,
          }));
          return;
        }
        if (response?.reason === 'visuals_emit_limit') {
          setEmitError('Emit limit reached for this mode this session.');
          return;
        }
        setEmitError('Could not push mode to the surface.');
      }
    );
  }

  // ── YouTube mode controls ─────────────────────────────────────────────────
  // The realtime server owns the queue: every command is acked back via the
  // `visuals:youtube` event, which the desk mirrors into local state.

  const [ytUrlInput, setYtUrlInput] = useState('');
  const [ytUrlError, setYtUrlError] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytQueue, setYtQueue] = useState<YoutubeQueueItem[]>([]);
  const [ytQueueIndex, setYtQueueIndex] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytMuted, setYtMuted] = useState(true);
  const [ytVolume, setYtVolume] = useState(80);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytSeekDragging, setYtSeekDragging] = useState<number | null>(null);
  const [ytExpandedItem, setYtExpandedItem] = useState<number | null>(null);
  const [ytItemSeek, setYtItemSeek] = useState('');
  const ytDragFrom = useRef<number | null>(null);

  // Mirror authoritative queue state from the server
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const onYoutube = (payload: {
      youtube: {
        queue: YoutubeQueueItem[]; queueIndex: number; playing: boolean; muted: boolean; volume: number;
      } | null
    }) => {
      const yt = payload.youtube;
      if (!yt) return;
      setYtQueue(yt.queue);
      setYtQueueIndex(yt.queueIndex);
      setYtPlaying(yt.playing);
      setYtMuted(yt.muted);
      setYtVolume(yt.volume);
    };
    const onStatus = (payload: { currentTime: number; duration: number }) => {
      setYtDuration(payload.duration);
      setYtCurrentTime((prev) => (ytSeekDragging !== null ? prev : payload.currentTime));
    };
    s.on('visuals:youtube', onYoutube);
    s.on('visuals:youtube_status', onStatus);
    return () => {
      s.off('visuals:youtube', onYoutube);
      s.off('visuals:youtube_status', onStatus);
    };
  }, [socket, connected, ytSeekDragging]);

  async function handleYtLoad() {
    const videoId = parseYoutubeVideoId(ytUrlInput);
    if (!videoId) {
      setYtUrlError('Invalid YouTube URL or video id');
      return;
    }
    setYtUrlError(null);
    setYtLoading(true);
    // Server-side oEmbed lookup so the queue shows rich titles + thumbnails
    let title: string | undefined;
    let thumbnail: string | undefined;
    try {
      const res = await fetch(`/api/youtube/oembed?id=${videoId}`);
      if (res.ok) {
        const meta = await res.json();
        title = meta.title ?? undefined;
        thumbnail = meta.thumbnail ?? undefined;
      }
    } catch {
      // metadata is best-effort — load the video regardless
    }
    setYtLoading(false);
    if (!canControlSurfaceForMode('youtube')) return;
    socket.current?.emit('orchestrator:visuals_youtube_load', { roomCode, videoId, title, thumbnail });
    setYtUrlInput('');
  }

  function handleYtPlayPause() {
    if (!canControlSurfaceForMode('youtube')) return;
    const next = !ytPlaying;
    setYtPlaying(next);
    socket.current?.emit(
      next ? 'orchestrator:visuals_youtube_play' : 'orchestrator:visuals_youtube_pause',
      { roomCode }
    );
  }

  function handleYtVolume(volume: number, muted: boolean) {
    if (!canControlSurfaceForMode('youtube')) return;
    setYtVolume(volume);
    setYtMuted(muted);
    socket.current?.emit('orchestrator:visuals_youtube_set_volume', { roomCode, volume, muted });
  }

  function handleYtSeekCommit(sec: number) {
    if (!canControlSurfaceForMode('youtube')) return;
    setYtSeekDragging(null);
    setYtCurrentTime(sec);
    socket.current?.emit('orchestrator:visuals_youtube_seek', { roomCode, sec });
  }

  function handleYtQueueJump(index: number, seekSec?: number) {
    if (!canControlSurfaceForMode('youtube')) return;
    socket.current?.emit('orchestrator:visuals_youtube_queue_jump', { roomCode, index, seekSec });
  }

  function handleYtQueueRemove(index: number) {
    if (!canControlSurfaceForMode('youtube')) return;
    socket.current?.emit('orchestrator:visuals_youtube_queue_remove', { roomCode, index });
  }

  const [ytConfirmMove, setYtConfirmMove] = useState<{ from: number; to: number } | null>(null);

  function emitYtQueueMove(from: number, to: number) {
    if (!canControlSurfaceForMode('youtube')) return;
    socket.current?.emit('orchestrator:visuals_youtube_queue_move', { roomCode, from, to });
  }

  function handleYtQueueMove(from: number, to: number) {
    if (from === to || to < 0 || to >= ytQueue.length) return;
    // Reordering around the live video deserves a second look
    if (from === ytQueueIndex || to === ytQueueIndex) {
      setYtConfirmMove({ from, to });
      return;
    }
    emitYtQueueMove(from, to);
  }

  function handleYtSetTransition(index: number, effect: YoutubeTransitionEffect) {
    if (!canControlSurfaceForMode('youtube')) return;
    socket.current?.emit('orchestrator:visuals_youtube_set_transition', { roomCode, index, effect });
  }

  function parseSeekInput(value: string): number | null {
    const parts = value.split(':').map((p) => Number(p.trim()));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
    return parts.length === 2 ? parts[0]! * 60 + parts[1]! : parts[0] ?? 0;
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── 3D mode controls ──────────────────────────────────────────────────────

  const [energy3d, setEnergy3d] = useState(0);

  function handle3dEnergy(level: number) {
    setEnergy3d(level);
    if (!canControlSurfaceForMode('3d')) return;
    socket.current?.emit('orchestrator:visuals_3d_set_energy', { roomCode, level });
  }

  function handle3dAction(action: 'shockwave' | 'burst') {
    if (!canControlSurfaceForMode('3d')) return;
    socket.current?.emit('orchestrator:visuals_3d_trigger_action', { roomCode, action });
  }

  // ── Art picker ────────────────────────────────────────────────────────────

  function handleArtChange(artId: string) {
    onWorkingStateChange({ artId, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId,
      palette: workingState.palette,
    });
  }

  function handleMicToggle(enabled: boolean) {
    onWorkingStateChange({ micEnabled: enabled, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId: workingState.artId,
      palette: workingState.palette,
      params: {
        micEnabled: enabled,
      },
    });
  }

  // ── Cue list (hidden permanently) ─────────────────────────────────────────

  /*
  const cues: RigCue[] = loadedRig?.cues ?? [];

  function handleNext() {
    if (cues.length === 0) return;
    const nextIndex = (workingState.cueIndex + 1) % cues.length;
    onWorkingStateChange({ cueIndex: nextIndex, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_next_cue', { roomCode });
  }

  function handlePrev() {
    if (cues.length === 0) return;
    const prevIndex = (workingState.cueIndex - 1 + cues.length) % cues.length;
    const cue = cues[prevIndex]!;
    onWorkingStateChange({ cueIndex: prevIndex, artId: cue.visualArtId, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId: cue.visualArtId,
      params: cue.params,
      palette: workingState.palette,
      transition: cue.transition?.type ?? 'cut',
    });
  }

  function handleJump(index: number) {
    if (cues.length === 0) return;
    const cue = cues[index]!;
    onWorkingStateChange({ cueIndex: index, artId: cue.visualArtId, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId: cue.visualArtId,
      params: cue.params,
      palette: workingState.palette,
      transition: cue.transition?.type ?? 'cut',
    });
  }
  */

  // ── Palette ───────────────────────────────────────────────────────────────

  function handlePaletteChange(palette: string[]) {
    onWorkingStateChange({ palette, dirty: true });
    if (!canControlSurfaceForMode('standard')) return;
    socket.current?.emit('orchestrator:visuals_set_palette', { roomCode, palette });
  }

  // ── Logo toggle ───────────────────────────────────────────────────────────

  function handleLogoToggle() {
    const next = !workingState.logoEnabled;
    onWorkingStateChange({ logoEnabled: next, dirty: true });

    if (!next) {
      socket.current?.emit('orchestrator:visuals_set_logo', { roomCode, logo: null });
      return;
    }

    socket.current?.emit('orchestrator:visuals_set_logo', {
      roomCode,
      logo: buildSurfaceLogo(logoRect),
    });
  }

  function buildSurfaceLogo(rect: { x: number; y: number; width: number } | null) {
    const logoConfig = (loadedRig?.console_config as any)?.logoConfig;
    const logoPath = loadedRig?.logo_asset_path;
    const base =
      entitlements.customRigLogo && logoPath
        ? {
          url: rigLogoUrl(logoPath),
          opacity: typeof logoConfig?.opacity === 'number' ? logoConfig.opacity : 0.8,
          position: (logoConfig?.position ?? 'center') as
            | 'center'
            | 'top-left'
            | 'top-right'
            | 'bottom-left'
            | 'bottom-right',
          effect: (logoConfig?.effect ?? 'none') as 'none' | 'pulse' | 'spin' | 'float' | 'neon',
        }
        : buildDefaultGlowSurfaceLogo();
    return rect ? { ...base, rect } : base;
  }

  async function persistLogoRect(rect: { x: number; y: number; width: number }) {
    if (!workingState.loadedRigId || !loadedRig) return;
    const existing = (loadedRig.console_config as Record<string, unknown>) ?? {};
    const logoConfig = { ...((existing.logoConfig as Record<string, unknown>) ?? {}), rect };
    try {
      const res = await fetch(`/api/rigs/${workingState.loadedRigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consoleConfig: { ...existing, logoConfig } }),
      });
      if (res.ok) {
        // Sync the rig back to the page so a later layout save keeps the logo rect.
        onLoadedRigChange?.(normalizeRigResponse(await res.json()));
      }
    } catch {
      // best-effort; the live emit already updated the surface this session
    }
  }

  function handleLogoRectChange(rect: { x: number; y: number; width: number }) {
    setLogoRect(rect);
    onWorkingStateChange({ dirty: true });
    if (workingState.logoEnabled) {
      socket.current?.emit('orchestrator:visuals_set_logo', {
        roomCode,
        logo: buildSurfaceLogo(rect),
      });
    }
    if (logoPersistTimer.current) clearTimeout(logoPersistTimer.current);
    logoPersistTimer.current = setTimeout(() => void persistLogoRect(rect), 500);
  }

  // ── Overwrite rig ─────────────────────────────────────────────────────────

  async function handleOverwriteRig() {
    if (!workingState.loadedRigId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/rigs/${workingState.loadedRigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          palette: workingState.palette,
          defaultVisualArtId: workingState.artId,
          logoEnabled: workingState.logoEnabled,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error ?? `HTTP ${res.status}`);
      }
      onWorkingStateChange({ dirty: false });
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle Collapse helper ────────────────────────────────────────────────

  const toggleCollapse = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ── Upsell (no surface entitlement) ──────────────────────────────────────

  if (!hasVisualsSurface) {
    return (
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-8 text-center">
        <Monitor className="w-10 h-10 text-neon-violet/60 mx-auto mb-4" />
        <NeonTitle as="h3" color="violet" className="text-lg font-black tracking-widest mb-2">
          VISUALS SURFACE
        </NeonTitle>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          Drive a full-screen projection surface from this desk.
        </p>
        <PlanGateUpsell feature="visualsSurface" roomEntitlements={roomState?.entitlements} />
      </NeonCard>
    );
  }

  const availableArts = Object.values(VISUAL_ART_REGISTRY).filter(
    (art) => entitlements?.availableVisualArts.includes(art.id) ?? true
  );

  return (
    <>
      {/* Queue-reorder confirmation (move touches the video in mix) */}
      <AlertDialog open={ytConfirmMove !== null} onOpenChange={(open) => !open && setYtConfirmMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reorder the live video?</AlertDialogTitle>
            <AlertDialogDescription>
              This reorder affects the video currently playing on the surface.
              The playback won&apos;t be interrupted, but its position in the queue will change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (ytConfirmMove) emitYtQueueMove(ytConfirmMove.from, ytConfirmMove.to);
                setYtConfirmMove(null);
              }}
            >
              Reorder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResizableTwoColumn
        storageKey="glow_visuals_preview_w"
        left={
          <NeonCard
            glowColor={editing ? 'violet' : 'none'}
            borderVariant={editing ? 'violet' : 'default'}
            hoverEffect={false}
            className={cn('p-4 lg:sticky lg:top-6', editing && 'ring-1 ring-neon-violet/30')}
          >
            <SectionHeader title="LIVE PREVIEW" color="cyan" />
            <div className="mt-3 pt-3 border-t border-white/5">
              <VisualsPreview
                mode={workingState.mode}
                artId={workingState.artId}
                palette={workingState.palette}
                displayName={workingState.displayName || 'Glow'}
                logo={workingState.logoEnabled ? buildSurfaceLogo(logoRect) : null}
                editMode={editing}
                onLogoRectChange={handleLogoRectChange}
                text={activeTextOverlay}
                qrConfig={activeQrConfig}
                roomCode={roomCode}
              />
            </div>
          </NeonCard>
        }
        right={
          <div className="flex min-w-0 flex-col gap-6 animate-in fade-in duration-300">
            {editing && hiddenSections.length > 0 ? (
              <div style={{ order: -2 }}>
                <h3 className="mb-2 text-xs font-cyber font-bold uppercase tracking-widest text-zinc-400">
                  Visuals panels
                </h3>
                <div className="rounded-2xl border border-dashed border-white/15 bg-muted/40 p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-cyber uppercase tracking-wider text-muted-foreground">
                    <Plus className="size-3.5" />
                    Add section
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hiddenSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => onShowSection(section.id)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-cyber uppercase tracking-wider text-zinc-300 transition-colors hover:border-neon-violet/30 hover:text-neon-violet"
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── 0. Visuals Mode (the active mode gates everything below) ──── */}
            {!isSectionHidden('visualsMode') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('visualsMode')}>
                <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className={cn('p-5', editing && 'rounded-none border-0')}>
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('visualsMode')}
                  >
                    <SectionHeader title="VISUALS MODE" color="violet" />
                    <button className="text-zinc-400 hover:text-white p-1">
                      {collapsedSections.visualsMode ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: collapsedSections.visualsMode ? '0fr' : '1fr',
                      transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {VISUALS_MODES.map((m) => {
                            const active = m.id === workingState.mode;
                            const onSurface = m.id === surfaceMode;
                            const modeEmit = canEmitVisualsMode(entitlements, emittedCounts, m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => handleModePreviewChange(m.id)}
                                disabled={!connected || !m.implemented}
                                title={m.description}
                                className={cn(
                                  'relative flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition-all duration-150',
                                  active
                                    ? 'border-neon-violet/50 bg-neon-violet/10 text-white'
                                    : m.implemented
                                      ? 'border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                                      : 'border-white/5 text-zinc-600 cursor-not-allowed opacity-60'
                                )}
                                id={`visuals-mode-${m.id}`}
                              >
                                <span className="text-xs font-cyber">{m.label}</span>
                                {m.implemented && active && !onSurface ? (
                                  <span className="text-[8px] font-cyber uppercase tracking-widest text-violet-300">
                                    Preview
                                  </span>
                                ) : null}
                                {m.implemented && onSurface ? (
                                  <span className="text-[8px] font-cyber uppercase tracking-widest text-neon-cyan">
                                    On surface
                                  </span>
                                ) : null}
                                {!m.implemented && (
                                  <span className="text-[8px] font-cyber uppercase tracking-widest text-zinc-600">
                                    Coming soon
                                  </span>
                                )}
                                {showEmitSlots && m.implemented && !modeEmit.allowed ? (
                                  <span className="text-[7px] font-cyber uppercase tracking-widest text-amber-400/80">
                                    Limit reached
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {previewingMode ? (
                          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                            <div className="text-xs text-violet-100/90">
                              <p>
                                Desk preview — surface is still{' '}
                                <span className="font-cyber uppercase">{surfaceMode}</span>.
                              </p>
                              {showEmitSlots ? (
                                <p className="mt-1 text-[10px] text-violet-200/70 font-cyber uppercase tracking-wide">
                                  Emits: {currentEmitCheck.used}/{currentEmitCheck.limit} for {workingState.mode}
                                </p>
                              ) : null}
                            </div>
                            <NeonButton
                              color="violet"
                              variant="solid"
                              onClick={handleEmitModeToSurface}
                              disabled={!connected || emittingMode || !currentEmitCheck.allowed}
                              className="text-[10px] uppercase tracking-widest h-8 px-4 shrink-0"
                            >
                              {emittingMode ? 'Pushing…' : 'Push to surface'}
                            </NeonButton>
                          </div>
                        ) : null}

                        {emitError ? (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                            <span>{emitError}</span>
                            {!currentEmitCheck.allowed ? (
                              <PlanGateUpsell feature="visualsEmit" roomEntitlements={roomState?.entitlements} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </NeonCard>
              </EditSectionChrome>
            ) : null}

            {/* ── 2. Live call mosaic ───────────────────────────────────────── */}
            {roomState && !isSectionHidden('liveCall') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('liveCall')}>
                <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className={cn('p-5', editing && 'rounded-none border-0')}>
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('liveCall')}
                  >
                    <SectionHeader title="LIVE CALL MOSAIC" color="cyan" />
                    <button className="text-zinc-400 hover:text-white p-1">
                      {collapsedSections.liveCall ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: collapsedSections.liveCall ? '0fr' : '1fr',
                      transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <LiveCallControls
                          roomCode={roomCode}
                          roomState={roomState}
                          entitlements={entitlements}
                          socket={socket}
                          connected={connected}
                        />
                      </div>
                    </div>
                  </div>
                </NeonCard>
              </EditSectionChrome>
            ) : null}

            {/* ── 3. Cue list (hidden permanently) ──────────────────────────── */}
            {/*
      {!isSectionHidden('cues') ? (
        <EditSectionChrome mode={mode} {...sectionChromeProps('cues')}>
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className={cn('p-5', editing && 'rounded-none border-0')}>
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => toggleCollapse('cues')}
        >
          <SectionHeader title="CUE LIST" color="violet" />
          <button className="text-zinc-400 hover:text-white p-1">
            {collapsedSections.cues ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.cues ? '0fr' : '1fr',
            transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-white/5">
              <CueList
                cues={cues}
                cueIndex={workingState.cueIndex}
                onNext={handleNext}
                onPrev={handlePrev}
                onJump={handleJump}
                disabled={!connected}
              />
            </div>
          </div>
        </div>
      </NeonCard>
        </EditSectionChrome>
      ) : null}
      */}


            {/* ── 4b. YouTube controls ──────────────────────────────────────── */}
            {workingState.mode === 'youtube' && (
              <div style={{ order: contextualSectionOrder }}>
                <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-5">
                  <style>{YT_DESK_CSS}</style>
                  <SectionHeader title="YOUTUBE" color="magenta" />
                  {!canControlSurfaceForMode('youtube') ? (
                    <p className="mt-3 text-xs text-violet-200/80 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                      Desk preview only — push YouTube to the surface to drive the projector.
                    </p>
                  ) : null}
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    {/* URL loader */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ytUrlInput}
                        onChange={(e) => setYtUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleYtLoad()}
                        placeholder="Paste YouTube URL or video id…"
                        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-neon-magenta/50 focus:outline-none focus:ring-1 focus:ring-neon-magenta/50 font-cyber"
                      />
                      <NeonButton
                        color="magenta"
                        variant="solid"
                        onClick={() => void handleYtLoad()}
                        disabled={!connected || !ytUrlInput.trim() || ytLoading}
                        className="text-xs uppercase tracking-widest h-9 px-4"
                      >
                        {ytLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
                      </NeonButton>
                    </div>
                    {ytUrlError && <p className="text-xs text-red-400">{ytUrlError}</p>}

                    {/* Transport */}
                    <div className="flex flex-wrap items-center gap-3">
                      <NeonButton
                        color="magenta"
                        variant={ytPlaying ? 'outline' : 'solid'}
                        onClick={handleYtPlayPause}
                        disabled={!connected || ytQueue.length === 0}
                        className="text-xs uppercase tracking-widest h-9 px-4"
                      >
                        {ytPlaying ? 'Pause' : 'Play'}
                      </NeonButton>

                      <button
                        type="button"
                        onClick={() => handleYtVolume(ytVolume, !ytMuted)}
                        disabled={!connected}
                        className="focus:outline-none"
                        aria-label="Toggle mute"
                      >
                        {ytMuted ? (
                          <ToggleLeft className="w-7 h-7 text-zinc-500" />
                        ) : (
                          <ToggleRight className="w-7 h-7 text-neon-magenta" />
                        )}
                      </button>
                      <span className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                        {ytMuted ? 'Muted' : 'Sound on'}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={ytVolume}
                        onChange={(e) => handleYtVolume(Number(e.target.value), ytMuted)}
                        disabled={!connected || ytMuted}
                        className="flex-1 min-w-[120px] accent-neon-magenta"
                      />
                      <span className="text-[10px] font-cyber text-zinc-500 w-8 text-right">{ytVolume}%</span>
                    </div>

                    {/* Seek slider — duration reported live by the surface */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                          Position
                        </label>
                        <span className="text-[10px] font-cyber text-zinc-500">
                          {formatTime(ytSeekDragging ?? ytCurrentTime)} / {ytDuration > 0 ? formatTime(ytDuration) : '–:––'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(1, Math.floor(ytDuration))}
                        value={Math.floor(ytSeekDragging ?? ytCurrentTime)}
                        onChange={(e) => setYtSeekDragging(Number(e.target.value))}
                        onPointerUp={() => ytSeekDragging !== null && handleYtSeekCommit(ytSeekDragging)}
                        onKeyUp={(e) => e.key !== 'Tab' && ytSeekDragging !== null && handleYtSeekCommit(ytSeekDragging)}
                        disabled={!connected || ytDuration <= 0}
                        className="w-full accent-neon-magenta"
                      />
                      {ytDuration <= 0 && (
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Duration appears once the surface is open and playing.
                        </p>
                      )}
                    </div>

                    {/* Queue */}
                    {ytQueue.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                          Queue
                        </p>
                        {ytQueue.map((item, i) => {
                          if (item.kind === 'transition') {
                            return (
                              <div
                                key={`tr-${i}`}
                                className="ml-6 flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-muted/40 px-3 py-1.5"
                                draggable
                                onDragStart={() => { ytDragFrom.current = i; }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (ytDragFrom.current !== null) handleYtQueueMove(ytDragFrom.current, i);
                                  ytDragFrom.current = null;
                                }}
                              >
                                <span className="text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
                                  ↯ Transition
                                </span>
                                <select
                                  value={item.effect}
                                  onChange={(e) => handleYtSetTransition(i, e.target.value as YoutubeTransitionEffect)}
                                  disabled={!connected}
                                  className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300 font-cyber focus:outline-none"
                                >
                                  {YT_TRANSITIONS.map((t) => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                  ))}
                                </select>
                                <YtTransitionPreview effect={item.effect} />
                              </div>
                            );
                          }

                          const isNow = i === ytQueueIndex;
                          const expanded = ytExpandedItem === i;
                          return (
                            <div
                              key={`${item.videoId}-${i}`}
                              draggable
                              onDragStart={() => { ytDragFrom.current = i; }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (ytDragFrom.current !== null) handleYtQueueMove(ytDragFrom.current, i);
                                ytDragFrom.current = null;
                              }}
                              className={cn(
                                'grid grid-cols-[90px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
                                isNow
                                  ? 'border-neon-magenta/60 bg-neon-magenta/5 shadow-[0_0_15px_rgba(255,0,200,0.25)] animate-pulse'
                                  : 'border-white/10 bg-muted/50'
                              )}
                            >
                              {/* In-mix sidebar button (consistent with the other mix layouts) */}
                              <button
                                type="button"
                                disabled={!connected || isNow}
                                onClick={() => handleYtQueueJump(i)}
                                className={cn(
                                  'h-full w-full flex flex-col items-center justify-center gap-1 border-r border-white/10 px-2 py-3 text-[9px] font-cyber uppercase tracking-widest transition-all select-none',
                                  isNow
                                    ? 'bg-neon-magenta/20 text-neon-magenta border-r-neon-magenta/30 shadow-[inset_0_0_8px_rgba(255,0,200,0.1)]'
                                    : 'bg-black/40 text-zinc-500 hover:text-zinc-300 cursor-pointer'
                                )}
                              >
                                <span
                                  className={cn(
                                    'size-2 rounded-full transition-transform duration-300',
                                    isNow ? 'bg-neon-magenta scale-110 shadow-[0_0_8px_#ff00c8]' : 'bg-zinc-600'
                                  )}
                                />
                                <span>{isNow ? 'In mix' : 'Play'}</span>
                              </button>

                              {/* Content */}
                              <div className="p-2.5">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[10px] font-cyber text-zinc-600 w-4 text-center cursor-grab">
                                    {ytQueue.slice(0, i + 1).filter((q) => q.kind === 'video').length}
                                  </span>
                                  {item.thumbnail ? (
                                    <img
                                      src={item.thumbnail}
                                      alt=""
                                      className="w-16 h-9 rounded object-cover flex-none border border-white/10"
                                    />
                                  ) : (
                                    <div className="w-16 h-9 rounded bg-black/50 border border-white/10 flex-none" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-cyber text-zinc-200 truncate">
                                      {item.title || item.videoId}
                                    </p>
                                    <p className="text-[9px] font-mono text-zinc-600 truncate">{item.videoId}</p>
                                  </div>
                                  {/* Reorder arrows */}
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={() => handleYtQueueMove(i, Math.max(0, i - 2))}
                                      disabled={!connected || i === 0}
                                      className="text-zinc-500 hover:text-white disabled:opacity-30 p-0.5"
                                      aria-label="Move up"
                                    >
                                      <ChevronUp className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleYtQueueMove(i, Math.min(ytQueue.length - 1, i + 2))}
                                      disabled={!connected || i >= ytQueue.length - 1}
                                      className="text-zinc-500 hover:text-white disabled:opacity-30 p-0.5"
                                      aria-label="Move down"
                                    >
                                      <ChevronDown className="size-3.5" />
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => { setYtExpandedItem(expanded ? null : i); setYtItemSeek(''); }}
                                    className={cn('p-1', expanded ? 'text-neon-magenta' : 'text-zinc-500 hover:text-white')}
                                    aria-label="Item options"
                                  >
                                    {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                  </button>
                                </div>

                                {/* Per-item dropdown */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateRows: expanded ? '1fr' : '0fr',
                                    transition: 'grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                                  }}
                                >
                                  <div className="overflow-hidden">
                                    <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                                      <label className="text-[9px] font-cyber text-zinc-500 uppercase tracking-widest">
                                        {isNow ? 'Seek to' : 'Play from'}
                                      </label>
                                      <input
                                        type="text"
                                        value={ytItemSeek}
                                        onChange={(e) => setYtItemSeek(e.target.value)}
                                        placeholder="mm:ss"
                                        className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-center text-[10px] text-white placeholder-zinc-700 focus:border-neon-magenta/50 focus:outline-none font-cyber"
                                      />
                                      <NeonButton
                                        color="magenta"
                                        variant="outline"
                                        onClick={() => {
                                          const sec = parseSeekInput(ytItemSeek);
                                          if (sec === null) return;
                                          if (isNow) handleYtSeekCommit(sec);
                                          else handleYtQueueJump(i, sec);
                                        }}
                                        disabled={!connected || !ytItemSeek.trim()}
                                        className="text-[10px] uppercase tracking-widest h-7 px-2.5"
                                      >
                                        Go
                                      </NeonButton>
                                      <div className="flex-1" />
                                      <button
                                        type="button"
                                        onClick={() => handleYtQueueRemove(i)}
                                        disabled={!connected || isNow}
                                        title={isNow ? 'Cannot remove the video in mix' : 'Remove from queue'}
                                        className="text-[10px] font-cyber uppercase tracking-widest text-zinc-500 hover:text-red-400 disabled:opacity-30"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-zinc-600 leading-relaxed">
                          Drag items or use the arrows to reorder. Transitions play on the surface
                          while the next video loads.
                        </p>
                      </div>
                    )}
                  </div>
                </NeonCard>
              </div>
            )}

            {/* ── 4c. 3D Visuals controls ───────────────────────────────────── */}
            {workingState.mode === '3d' && (
              <div style={{ order: contextualSectionOrder }}>
                <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
                  <SectionHeader title="3D VISUALS — ENERGY ORB" color="cyan" />
                  {!canControlSurfaceForMode('3d') ? (
                    <p className="mt-3 text-xs text-violet-200/80 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                      Desk preview only — push 3D to the surface to drive the projector.
                    </p>
                  ) : null}
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-5">
                    {/* Energy level */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                          Energy Level
                        </label>
                        <span className="text-xs font-cyber text-neon-cyan">{energy3d} / 5</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => handle3dEnergy(level)}
                            disabled={!connected}
                            className={cn(
                              'rounded-lg border py-2.5 text-xs font-cyber transition-all',
                              level === energy3d
                                ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                                : level < energy3d
                                  ? 'border-neon-cyan/20 bg-neon-cyan/5 text-zinc-400'
                                  : 'border-white/10 bg-muted/50 text-zinc-500 hover:border-white/20 hover:text-zinc-300'
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-1.5">
                        0 = floor · 5 = space. The orb rises, glows and spins faster with each level.
                      </p>
                    </div>

                    {/* Actions */}
                    <div>
                      <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-2">
                        Actions
                      </label>
                      <div className="flex gap-3">
                        <NeonButton
                          color="cyan"
                          variant="solid"
                          onClick={() => handle3dAction('shockwave')}
                          disabled={!connected}
                          className="flex-1 text-xs uppercase tracking-widest h-9"
                        >
                          Shockwave
                        </NeonButton>
                        <NeonButton
                          color="cyan"
                          variant="outline"
                          onClick={() => handle3dAction('burst')}
                          disabled={!connected}
                          className="flex-1 text-xs uppercase tracking-widest h-9"
                        >
                          Burst
                        </NeonButton>
                      </div>
                    </div>
                  </div>
                </NeonCard>
              </div>
            )}

            {/* ── 4. Visual Art ─────────────────────────────────────────────── */}
            {workingState.mode === 'standard' && !isSectionHidden('art') && (
              <EditSectionChrome mode={mode} {...sectionChromeProps('art')}>
                <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className={cn('p-5', editing && 'rounded-none border-0')}>
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('art')}
                  >
                    <SectionHeader title="VISUAL ART" color="magenta" />
                    <button className="text-zinc-400 hover:text-white p-1">
                      {collapsedSections.art ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: collapsedSections.art ? '0fr' : '1fr',
                      transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="grid grid-cols-1 gap-2">
                          {availableArts.map((art) => {
                            const active = art.id === workingState.artId;
                            const micEnabled = workingState.micEnabled !== false;

                            if (active) {
                              return (
                                <div
                                  key={art.id}
                                  className="w-full rounded-xl border border-neon-magenta/50 bg-neon-magenta/10 text-white px-4 py-4 text-left transition-all duration-150"
                                  id={`art-${art.id}`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="w-3 h-3 rounded-full mt-0.5 flex-none border bg-neon-magenta border-neon-magenta" />
                                    <div className="flex-1">
                                      <p className="text-xs font-cyber">{art.label}</p>
                                      {art.description && (
                                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">{art.description}</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Nested Art Settings (Palette & Mic Options) */}
                                  <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                                    {/* 1. Palette Editor */}
                                    <div>
                                      <p className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-2">Art Palette</p>
                                      <PaletteEditor
                                        palette={workingState.palette}
                                        onChange={handlePaletteChange}
                                        disabled={!connected}
                                      />
                                    </div>

                                    {/* 2. Microphone Reactivity (if requiresAudio) */}
                                    {art.requiresAudio && (
                                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                                        <div className="pr-2">
                                          <p className="text-xs font-cyber text-white uppercase tracking-wider">Microphone Reactivity</p>
                                          <p className="text-[10px] text-zinc-500 leading-normal mt-0.5">
                                            Activate microphone capture on the visuals display screen to animate this art reactively.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={!connected}
                                          onClick={() => {
                                            handleMicToggle(!micEnabled);
                                          }}
                                          className={cn(
                                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-neon-violet focus:ring-offset-1 focus:ring-offset-black',
                                            micEnabled ? 'bg-neon-violet' : 'bg-zinc-700'
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                              micEnabled ? 'translate-x-4' : 'translate-x-0'
                                            )}
                                          />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <button
                                  key={art.id}
                                  type="button"
                                  onClick={() => handleArtChange(art.id)}
                                  disabled={!connected}
                                  className="w-full flex items-start gap-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-400 hover:text-zinc-200 px-4 py-3 text-left transition-all duration-150"
                                  id={`art-${art.id}`}
                                >
                                  <span className="w-3 h-3 rounded-full mt-0.5 flex-none border border-white/20 bg-transparent" />
                                  <div>
                                    <p className="text-xs font-cyber">{art.label}</p>
                                    {art.description && (
                                      <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{art.description}</p>
                                    )}
                                  </div>
                                </button>
                              );
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </NeonCard>
              </EditSectionChrome>
            )}

            {/* ── 6. Show Name & Logo (Mix layout) ───────────────────────────── */}
            {!isSectionHidden('showName') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('showName')}>
                <div
                  className={cn(
                    'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
                    workingState.logoEnabled
                      ? 'border-neon-cyan/60 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse'
                      : 'border-white/10 bg-muted/50',
                    editing && 'rounded-none'
                  )}
                >
                  {/* Sidebar Mix Control Button */}
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={handleLogoToggle}
                    className={cn(
                      'h-full w-full flex flex-col items-center justify-center gap-1.5 border-r border-white/10 px-3 py-4 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer select-none',
                      workingState.logoEnabled
                        ? 'bg-neon-cyan/20 text-neon-cyan border-r-neon-cyan/30 shadow-[inset_0_0_8px_rgba(0,229,255,0.1)]'
                        : 'bg-black/40 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full transition-transform duration-300',
                        workingState.logoEnabled ? 'bg-neon-cyan scale-110 shadow-[0_0_8px_#00e5ff]' : 'bg-zinc-600'
                      )}
                    />
                    <span>{workingState.logoEnabled ? 'In mix' : 'Out of mix'}</span>
                  </button>

                  {/* Content Area */}
                  <div className="p-5 flex flex-col gap-4">
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCollapse('showName')}
                    >
                      <div className="flex items-center gap-2">
                        <SectionHeader title="SHOW NAME & LOGO" color="cyan" />
                        {workingState.logoEnabled && (
                          <span className="inline-flex items-center rounded-full bg-neon-cyan/10 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-neon-cyan animate-pulse">
                            Live
                          </span>
                        )}
                      </div>
                      <button className="text-zinc-400 hover:text-white p-1">
                        {collapsedSections.showName ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: collapsedSections.showName ? '0fr' : '1fr',
                        transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-4 pt-3 border-t border-white/5">
                          {/* Show Name input */}
                          <div>
                            <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                              Show Name (Display Name)
                            </label>
                            <input
                              type="text"
                              value={workingState.displayName || ''}
                              onChange={(e) => onWorkingStateChange({ displayName: e.target.value, dirty: true })}
                              onBlur={(e) => handleDisplayNameChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleDisplayNameChange((e.target as HTMLInputElement).value);
                                }
                              }}
                              placeholder="Glow"
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                            />
                          </div>

                          {/* Name position — independent from the logo so they never collide */}
                          <div>
                            <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                              Name Position
                            </label>
                            <select
                              value={displayNamePosition}
                              onChange={(e) => handleDisplayNamePosition(e.target.value as any)}
                              disabled={!connected}
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                            >
                              <option value="center">Center</option>
                              <option value="top-left">Top-Left corner</option>
                              <option value="top-right">Top-Right corner</option>
                              <option value="bottom-left">Bottom-Left corner</option>
                              <option value="bottom-right">Bottom-Right corner</option>
                            </select>
                            <p className="text-[10px] text-zinc-600 mt-1">
                              If it matches the logo position they stack instead of overlapping.
                            </p>
                          </div>

                          {entitlements.customRigLogo ? (
                            loadedRig?.logo_asset_path ? (
                              <div className="flex items-center gap-4 pt-2">
                                <div className="w-14 h-14 rounded-xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center flex-none">
                                  <img
                                    src={rigLogoUrl(loadedRig.logo_asset_path)}
                                    alt="Rig logo"
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-cyber text-zinc-300 truncate mb-1">
                                    {loadedRig.logo_asset_path.split('/').pop()}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">From loaded rig</p>
                                </div>
                              </div>
                            ) : (
                              <PlanGate feature="customRigLogo" roomEntitlements={roomState?.entitlements}>
                                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
                                  <p className="text-xs font-cyber text-muted-foreground tracking-wide">
                                    No logo on this rig
                                  </p>
                                  <p className="text-[10px] text-zinc-600 mt-1">
                                    Upload a logo in the Rigs Manager to enable this toggle.
                                  </p>
                                </div>
                              </PlanGate>
                            )
                          ) : (
                            <div className="flex items-center gap-4 pt-2 rounded-xl border border-white/10 bg-muted/40 p-4">
                              <GlowLogo className="h-10 w-auto shrink-0 text-neon-magenta" />
                              <div className="min-w-0">
                                <p className="text-xs font-cyber text-zinc-200 uppercase tracking-wider">
                                  {GLOW_BRAND_NAME}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-1">
                                  Toggle puts Glow branding on stage. Upgrade to Venue for your logo.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </EditSectionChrome>
            ) : null}

            {/* ── 7. Live Custom Text Overlay (Mix layout) ───────────────────── */}
            {!isSectionHidden('text') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('text')}>
                <div
                  className={cn(
                    'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
                    activeTextOverlay
                      ? 'border-neon-violet/60 bg-neon-violet/5 shadow-[0_0_15px_rgba(176,38,255,0.25)] animate-pulse'
                      : 'border-white/10 bg-muted/50',
                    editing && 'rounded-none'
                  )}
                >
                  {/* Sidebar Mix Control Button */}
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={() => {
                      if (activeTextOverlay) {
                        handleClearText();
                      } else {
                        handleSendText();
                      }
                    }}
                    className={cn(
                      'h-full w-full flex flex-col items-center justify-center gap-1.5 border-r border-white/10 px-3 py-4 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer select-none',
                      activeTextOverlay
                        ? 'bg-neon-violet/20 text-neon-violet border-r-neon-violet/30 shadow-[inset_0_0_8px_rgba(176,38,255,0.1)]'
                        : 'bg-black/40 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full transition-transform duration-300',
                        activeTextOverlay ? 'bg-neon-violet scale-110 shadow-[0_0_8px_#b026ff]' : 'bg-zinc-600'
                      )}
                    />
                    <span>{activeTextOverlay ? 'In mix' : 'Out of mix'}</span>
                  </button>

                  {/* Content Area */}
                  <div className="p-5 flex flex-col gap-4">
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCollapse('text')}
                    >
                      <div className="flex items-center gap-2">
                        <SectionHeader title="LIVE CUSTOM TEXT OVERLAY" color="violet" />
                        {activeTextOverlay && (
                          <span className="inline-flex items-center rounded-full bg-neon-violet/10 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-neon-violet animate-pulse">
                            Live
                          </span>
                        )}
                      </div>
                      <button className="text-zinc-400 hover:text-white p-1">
                        {collapsedSections.text ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: collapsedSections.text ? '0fr' : '1fr',
                        transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-4 pt-3 border-t border-white/5">
                          <div>
                            <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                              Overlay Text
                            </label>
                            <input
                              type="text"
                              value={textInput}
                              onChange={(e) => setTextInput(e.target.value)}
                              placeholder="E.g. GET READY TO BOUNCE!"
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-neon-violet/50 focus:outline-none focus:ring-1 focus:ring-neon-violet/50 font-cyber"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Animation Mode
                              </label>
                              <select
                                value={textMode}
                                onChange={(e) => setTextMode(e.target.value as any)}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-violet/50 focus:outline-none focus:ring-1 focus:ring-neon-violet/50 font-cyber"
                              >
                                <option value="marquee">Marquee (Scrolling)</option>
                                <option value="word_by_word">Word by Word</option>
                                <option value="spread_grid">Spread Grid</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Speed (Hz / Ratio)
                              </label>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setTextSpeed(Math.max(1, textSpeed - 1))}
                                  className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                                >
                                  -
                                </button>
                                <input
                                  type="range"
                                  min="1"
                                  max="20"
                                  value={textSpeed}
                                  onChange={(e) => setTextSpeed(Number(e.target.value))}
                                  className="flex-1 accent-neon-violet"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTextSpeed(Math.min(20, textSpeed + 1))}
                                  className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-[10px] font-cyber text-zinc-500 text-right mt-1">
                                {textSpeed} Hz
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Font Size (px)
                              </label>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setTextFontSize(Math.max(24, textFontSize - 4))}
                                  className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                                >
                                  -
                                </button>
                                <input
                                  type="range"
                                  min="24"
                                  max="120"
                                  value={textFontSize}
                                  onChange={(e) => setTextFontSize(Number(e.target.value))}
                                  className="flex-1 accent-neon-violet"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTextFontSize(Math.min(120, textFontSize + 4))}
                                  className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-[10px] font-cyber text-zinc-500 text-right mt-1">
                                {textFontSize} px
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Color Presets / Hex
                              </label>
                              <div className="flex gap-1.5 mb-2">
                                {['#ffffff', '#ff00c8', '#00e3ff', '#b026ff', '#eab308'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setTextColorHex(c)}
                                    className={cn(
                                      "w-6 h-6 rounded-full border transition",
                                      textColorHex === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                              <input
                                type="text"
                                value={textColorHex}
                                onChange={(e) => setTextColorHex(e.target.value)}
                                placeholder="#ffffff"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1 text-xs text-white focus:border-neon-violet/50 focus:outline-none focus:ring-1 focus:ring-neon-violet/50 font-cyber"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs font-cyber text-zinc-400 uppercase tracking-wider">
                              Loop Animation
                            </span>
                            <button
                              type="button"
                              onClick={() => setTextLoop(!textLoop)}
                              className="focus:outline-none"
                            >
                              {textLoop ? (
                                <ToggleRight className="w-8 h-8 text-neon-violet" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-zinc-500" />
                              )}
                            </button>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <NeonButton
                              color="violet"
                              variant="solid"
                              onClick={handleSendText}
                              disabled={!connected || !textInput.trim()}
                              className="flex-1 gap-2 text-xs uppercase tracking-widest h-9 px-4"
                            >
                              Send Overlay
                            </NeonButton>
                            <NeonButton
                              color="violet"
                              variant="outline"
                              onClick={handleClearText}
                              disabled={!connected}
                              className="gap-2 text-xs uppercase tracking-widest h-9 px-4 text-zinc-400 hover:text-white"
                            >
                              Clear
                            </NeonButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </EditSectionChrome>
            ) : null}

            {/* ── 8. Live QR Overlay (Mix layout) ────────────────────────────── */}
            {!isSectionHidden('qr') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('qr')}>
                <div
                  className={cn(
                    'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
                    qrEnabled
                      ? 'border-neon-cyan/60 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse'
                      : 'border-white/10 bg-muted/50',
                    editing && 'rounded-none'
                  )}
                >
                  {/* Sidebar Mix Control Button */}
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={() => {
                      const next = !qrEnabled;
                      setQrEnabled(next);
                      handleQrUpdate(next);
                    }}
                    className={cn(
                      'h-full w-full flex flex-col items-center justify-center gap-1.5 border-r border-white/10 px-3 py-4 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer select-none',
                      qrEnabled
                        ? 'bg-neon-cyan/20 text-neon-cyan border-r-neon-cyan/30 shadow-[inset_0_0_8px_rgba(0,229,255,0.1)]'
                        : 'bg-black/40 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full transition-transform duration-300',
                        qrEnabled ? 'bg-neon-cyan scale-110 shadow-[0_0_8px_#00e5ff]' : 'bg-zinc-600'
                      )}
                    />
                    <span>{qrEnabled ? 'In mix' : 'Out of mix'}</span>
                  </button>

                  {/* Content Area */}
                  <div className="p-5 flex flex-col gap-4">
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCollapse('qr')}
                    >
                      <div className="flex items-center gap-2">
                        <SectionHeader title="LIVE QR OVERLAY" color="cyan" />
                        {qrEnabled && (
                          <span className="inline-flex items-center rounded-full bg-neon-cyan/10 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-neon-cyan animate-pulse">
                            Live
                          </span>
                        )}
                      </div>
                      <button className="text-zinc-400 hover:text-white p-1">
                        {collapsedSections.qr ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: (!collapsedSections.qr && qrEnabled) ? '1fr' : '0fr',
                        transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-4 pt-3 border-t border-white/5">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Screen Position
                              </label>
                              <select
                                value={qrPosition}
                                onChange={(e) => {
                                  const pos = e.target.value as any;
                                  setQrPosition(pos);
                                  handleQrUpdate(true, pos);
                                }}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                              >
                                <option value="center">Center (Fullscreen Banner)</option>
                                <option value="top-left">Top-Left corner</option>
                                <option value="top-right">Top-Right corner</option>
                                <option value="bottom-left">Bottom-Left corner</option>
                                <option value="bottom-right">Bottom-Right corner</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                                Watermark Size
                              </label>
                              <select
                                value={qrSize}
                                onChange={(e) => {
                                  const size = e.target.value as any;
                                  setQrSize(size);
                                  handleQrUpdate(true, qrPosition, size);
                                }}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                              <p className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                                Periodic Visibility Timer
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-cyber text-zinc-500 uppercase tracking-wider">
                                  {qrPeriodic ? 'Custom' : 'Always'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQrTogglePeriodic(!qrPeriodic)}
                                  className="focus:outline-none"
                                  aria-label="Toggle periodic QR visibility"
                                >
                                  {qrPeriodic ? (
                                    <ToggleRight className="w-6 h-6 text-neon-cyan" />
                                  ) : (
                                    <ToggleLeft className="w-6 h-6 text-zinc-500" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {qrPeriodic ? (
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-300 py-1 leading-relaxed animate-in fade-in duration-200">
                                <span>Every</span>
                                <input
                                  type="number"
                                  min="10"
                                  max="300"
                                  value={qrInterval}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setQrInterval(val);
                                    handleQrUpdate(true, qrPosition, qrSize, val, qrDuration);
                                  }}
                                  className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-center text-xs text-white focus:border-neon-cyan/50 focus:outline-none font-cyber"
                                />
                                <span>seconds, show the QR code for</span>
                                <input
                                  type="number"
                                  min="5"
                                  max="120"
                                  value={qrDuration}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setQrDuration(val);
                                    handleQrUpdate(true, qrPosition, qrSize, qrInterval, val);
                                  }}
                                  className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-center text-xs text-white focus:border-neon-cyan/50 focus:outline-none font-cyber"
                                />
                                <span>seconds.</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-zinc-500 italic py-1">
                                The QR code is permanently visible on the surface.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </EditSectionChrome>
            ) : null}

            {/* ── 9. Rig ────────────────────────────────────────────────────── */}
            {editing && !isSectionHidden('rig') ? (
              <EditSectionChrome mode={mode} {...sectionChromeProps('rig')}>
                <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className={cn('p-5', editing && 'rounded-none border-0')}>
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('rig')}
                  >
                    <div className="flex items-center gap-2">
                      <SectionHeader title="RIG" color="cyan" />
                      {workingState.dirty && (
                        <span className="flex items-center gap-1.5 text-[9px] font-cyber text-amber-400 tracking-widest uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Unsaved
                        </span>
                      )}
                    </div>
                    <button className="text-zinc-400 hover:text-white p-1">
                      {collapsedSections.rig ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: collapsedSections.rig ? '0fr' : '1fr',
                      transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-white/5">
                        {loadedRig ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                              <p className="text-[9px] font-cyber text-zinc-500 uppercase tracking-widest mb-0.5">
                                Loaded rig
                              </p>
                              <p className="text-sm font-cyber text-white">{loadedRig.name}</p>
                            </div>

                            {saveError && (
                              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-900/10 px-3 py-2 text-xs text-red-400">
                                <AlertTriangle className="w-3.5 h-3.5 flex-none" />
                                {saveError}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <NeonButton
                                color="cyan"
                                variant="outline"
                                onClick={() => void handleOverwriteRig()}
                                disabled={saving || !workingState.dirty || !workingState.loadedRigId}
                                className="flex-1 gap-2 text-xs uppercase tracking-widest h-9 px-4"
                                id="overwrite-rig-btn"
                              >
                                {saving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                Overwrite Rig
                              </NeonButton>
                            </div>

                            <p className="text-[10px] text-zinc-600 leading-relaxed">
                              Overwrites the loaded rig's palette, art, and logo with your live values.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
                            <RefreshCw className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                            <p className="text-xs font-cyber text-muted-foreground tracking-wide">
                              No rig loaded for this room
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </NeonCard>
              </EditSectionChrome>
            ) : null}
          </div>
        }
      />
    </>
  );
}
