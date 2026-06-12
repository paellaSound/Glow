'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  Monitor,
  Share2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import QRCode from 'qrcode';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { PaletteEditor } from '@/components/glow/palette-editor';
import { CueList, type RigCue } from '@/components/glow/cue-list';
import type { Socket } from 'socket.io-client';
import type { RoomStatePayload, VisualsMode } from '@/lib/glow/types';
import { VISUAL_ART_REGISTRY } from 'glow-visuals';
import { LiveCallControls } from '@/components/glow/live-call-controls';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import { cn } from '@/lib/utils';
import { VisualsPreview } from '@/components/glow/visuals-preview';
import { parseYoutubeVideoId } from '@/lib/youtube';

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
};

export type RigWithCues = {
  id: string;
  name: string;
  default_visual_art_id: string;
  palette: string[];
  logo_asset_path: string | null;
  logo_enabled: boolean;
  console_config: Record<string, unknown>;
  cues: RigCue[];
};

interface VisualsTabProps {
  code: string;
  socket: React.MutableRefObject<Socket | null>;
  roomState: RoomStatePayload | null;
  connected: boolean;
  workingState: VisualsWorkingState;
  onWorkingStateChange: (patch: Partial<VisualsWorkingState>) => void;
  loadedRig: RigWithCues | null;
  mode?: 'edit' | 'operate';
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
  { id: '3d', label: '3D Visuals', description: 'Music-reactive 3D scenes with energy levels', implemented: true },
  { id: 'pptt', label: 'PPTT Mode', description: 'Google Slides presentation with live QR', implemented: false },
];

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
  mode = 'edit',
}: VisualsTabProps) {
  const roomCode = code.toUpperCase();
  const { teamEntitlements } = useTeamEntitlements();
  const entitlements = mergeEntitlementsForUi(roomState?.entitlements, teamEntitlements);
  const hasVisualsSurface = entitlements.visualsSurface;

  // Output section state
  const [mintingToken, setMintingToken] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [surfaceConnected, setSurfaceConnected] = useState(false);

  // Rig overwrite state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Collapsible cards state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    preview: false,
    output: false,
    liveCall: false,
    cues: false,
    visualsMode: false,
    art: false,
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
  function handleDisplayNameChange(name: string) {
    onWorkingStateChange({ displayName: name, dirty: true });
    socket.current?.emit('orchestrator:visuals_set_display', {
      roomCode,
      displayName: name,
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

  // Detect visuals:subscribed events via a socket listener
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    if (shareUrl) setSurfaceConnected(true);
  }, [shareUrl, socket]);

  // ── Token mint + open / share ─────────────────────────────────────────────

  async function mintToken(): Promise<string | null> {
    setMintingToken(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/visuals-token`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error ?? `HTTP ${res.status}`);
      }
      const { url } = await res.json() as { url: string; token: string; expiresAt: string };
      return url.startsWith('http') ? url : `${window.location.origin}${url}`;
    } catch (err: any) {
      alert(`Could not mint visuals token: ${err.message}`);
      return null;
    } finally {
      setMintingToken(false);
    }
  }

  async function handleOpenVisuals() {
    const fullUrl = await mintToken();
    if (!fullUrl) return;
    setShareUrl(fullUrl);
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
    setSurfaceConnected(true);
    // Build QR
    const dataUrl = await QRCode.toDataURL(fullUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
  }

  async function handleShare() {
    if (shareUrl) {
      await copyUrl(shareUrl);
      return;
    }
    const fullUrl = await mintToken();
    if (!fullUrl) return;
    setShareUrl(fullUrl);
    await copyUrl(fullUrl);
    const dataUrl = await QRCode.toDataURL(fullUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  }

  // ── Visuals mode selector ─────────────────────────────────────────────────

  function handleModeChange(mode: VisualsMode) {
    if (mode === workingState.mode) return;
    onWorkingStateChange({ mode, dirty: true });
    socket.current?.emit('orchestrator:visuals_set_mode', { roomCode, mode });
  }

  // ── YouTube mode controls ─────────────────────────────────────────────────

  const [ytUrlInput, setYtUrlInput] = useState('');
  const [ytUrlError, setYtUrlError] = useState<string | null>(null);
  const [ytQueue, setYtQueue] = useState<{ videoId: string; title?: string }[]>([]);
  const [ytQueueIndex, setYtQueueIndex] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytMuted, setYtMuted] = useState(true);
  const [ytVolume, setYtVolume] = useState(80);
  const [ytSeekInput, setYtSeekInput] = useState('');

  function handleYtLoad() {
    const videoId = parseYoutubeVideoId(ytUrlInput);
    if (!videoId) {
      setYtUrlError('Invalid YouTube URL or video id');
      return;
    }
    setYtUrlError(null);
    socket.current?.emit('orchestrator:visuals_youtube_load', { roomCode, videoId });
    setYtQueue((prev) => {
      const idx = prev.findIndex((q) => q.videoId === videoId);
      if (idx !== -1) {
        setYtQueueIndex(idx);
        return prev;
      }
      setYtQueueIndex(prev.length);
      return [...prev, { videoId }];
    });
    setYtPlaying(true);
    setYtUrlInput('');
  }

  function handleYtPlayPause() {
    const next = !ytPlaying;
    setYtPlaying(next);
    socket.current?.emit(
      next ? 'orchestrator:visuals_youtube_play' : 'orchestrator:visuals_youtube_pause',
      { roomCode }
    );
  }

  function handleYtVolume(volume: number, muted: boolean) {
    setYtVolume(volume);
    setYtMuted(muted);
    socket.current?.emit('orchestrator:visuals_youtube_set_volume', { roomCode, volume, muted });
  }

  function handleYtSeek() {
    const parts = ytSeekInput.split(':').map((p) => Number(p.trim()));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return;
    const sec = parts.length === 2 ? parts[0]! * 60 + parts[1]! : parts[0] ?? 0;
    socket.current?.emit('orchestrator:visuals_youtube_seek', { roomCode, sec });
  }

  function handleYtQueueJump(index: number) {
    const item = ytQueue[index];
    if (!item) return;
    setYtQueueIndex(index);
    setYtPlaying(true);
    socket.current?.emit('orchestrator:visuals_youtube_queue_jump', { roomCode, index });
  }

  function handleYtQueueRemove(index: number) {
    const next = ytQueue.filter((_, i) => i !== index);
    setYtQueue(next);
    if (index < ytQueueIndex) setYtQueueIndex(ytQueueIndex - 1);
    socket.current?.emit('orchestrator:visuals_youtube_queue_set', { roomCode, items: next });
  }

  // ── 3D mode controls ──────────────────────────────────────────────────────

  const [energy3d, setEnergy3d] = useState(0);

  function handle3dEnergy(level: number) {
    setEnergy3d(level);
    socket.current?.emit('orchestrator:visuals_3d_set_energy', { roomCode, level });
  }

  function handle3dAction(action: 'shockwave' | 'burst') {
    socket.current?.emit('orchestrator:visuals_3d_trigger_action', { roomCode, action });
  }

  // ── Art picker ────────────────────────────────────────────────────────────

  function handleArtChange(artId: string) {
    onWorkingStateChange({ artId, dirty: true });
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId,
      palette: workingState.palette,
    });
  }

  // ── Cue list ──────────────────────────────────────────────────────────────

  const cues: RigCue[] = loadedRig?.cues ?? [];

  function handleNext() {
    if (cues.length === 0) return;
    const nextIndex = (workingState.cueIndex + 1) % cues.length;
    onWorkingStateChange({ cueIndex: nextIndex, dirty: true });
    socket.current?.emit('orchestrator:visuals_next_cue', { roomCode });
  }

  function handlePrev() {
    if (cues.length === 0) return;
    const prevIndex = (workingState.cueIndex - 1 + cues.length) % cues.length;
    const cue = cues[prevIndex]!;
    onWorkingStateChange({ cueIndex: prevIndex, artId: cue.visualArtId, dirty: true });
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
    socket.current?.emit('orchestrator:visuals_set_scene', {
      roomCode,
      artId: cue.visualArtId,
      params: cue.params,
      palette: workingState.palette,
      transition: cue.transition?.type ?? 'cut',
    });
  }

  // ── Palette ───────────────────────────────────────────────────────────────

  function handlePaletteChange(palette: string[]) {
    onWorkingStateChange({ palette, dirty: true });
    socket.current?.emit('orchestrator:visuals_set_palette', { roomCode, palette });
  }

  // ── Logo toggle ───────────────────────────────────────────────────────────

  function handleLogoToggle() {
    const next = !workingState.logoEnabled;
    onWorkingStateChange({ logoEnabled: next, dirty: true });

    const logoConfig = (loadedRig?.console_config as any)?.logoConfig;
    const logoPath = loadedRig?.logo_asset_path;

    if (next && logoPath) {
      socket.current?.emit('orchestrator:visuals_set_logo', {
        roomCode,
        logo: {
          url: rigLogoUrl(logoPath),
          opacity: typeof logoConfig?.opacity === 'number' ? logoConfig.opacity : 0.8,
          position: logoConfig?.position ?? 'center',
          effect: logoConfig?.effect ?? 'none',
        },
      });
    } else {
      socket.current?.emit('orchestrator:visuals_set_logo', { roomCode, logo: null });
    }
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
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Drive a full-screen projection surface from this desk. Upgrade to{' '}
          <strong className="text-white">Plus 25</strong> to unlock the visual arts engine.
        </p>
        <NeonButton color="violet" variant="solid" className="text-xs uppercase tracking-widest" disabled>
          Upgrade Plan
        </NeonButton>
      </NeonCard>
    );
  }

  const availableArts = Object.values(VISUAL_ART_REGISTRY).filter(
    (art) => entitlements?.availableVisualArts.includes(art.id) ?? true
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* ── 0. Visuals Preview ────────────────────────────────────────── */}
      <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => toggleCollapse('preview')}
        >
          <SectionHeader title="LIVE PREVIEW" color="cyan" />
          <button className="text-zinc-400 hover:text-white p-1">
            {collapsedSections.preview ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.preview ? '0fr' : '1fr',
            transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-white/5">
              <VisualsPreview
                artId={workingState.artId}
                palette={workingState.palette}
                displayName={workingState.displayName || 'Glow'}
                logo={
                  workingState.logoEnabled && loadedRig?.logo_asset_path
                    ? {
                        url: rigLogoUrl(loadedRig.logo_asset_path),
                        opacity:
                          typeof (loadedRig.console_config as any)?.logoConfig?.opacity === 'number'
                            ? (loadedRig.console_config as any).logoConfig.opacity
                            : 0.8,
                        position: (loadedRig.console_config as any)?.logoConfig?.position ?? 'center',
                        effect: (loadedRig.console_config as any)?.logoConfig?.effect ?? 'none',
                      }
                    : null
                }
                text={activeTextOverlay}
                qrConfig={activeQrConfig}
                roomCode={roomCode}
              />
            </div>
          </div>
        </div>
      </NeonCard>

      {/* ── 1. Output ──────────────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => toggleCollapse('output')}
        >
          <div className="flex items-center gap-4">
            <SectionHeader title="OUTPUT SURFACE" color="cyan" />
            {surfaceConnected && (
              <span className="flex items-center gap-1.5 text-[9px] font-cyber text-neon-cyan tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                Surface linked
              </span>
            )}
          </div>
          <button className="text-zinc-400 hover:text-white p-1">
            {collapsedSections.output ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.output ? '0fr' : '1fr',
            transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex flex-wrap gap-3 mb-4">
                <NeonButton
                  color="cyan"
                  variant="solid"
                  onClick={() => void handleOpenVisuals()}
                  disabled={mintingToken || !connected}
                  className="gap-2 text-xs uppercase tracking-widest h-9 px-4"
                  id="open-visuals-btn"
                >
                  {mintingToken ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" />
                  )}
                  Open Visuals
                </NeonButton>

                <NeonButton
                  color="cyan"
                  variant="outline"
                  onClick={() => void handleShare()}
                  disabled={mintingToken || !connected}
                  className="gap-2 text-xs uppercase tracking-widest h-9 px-4"
                  id="share-visuals-btn"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {copyDone ? 'Copied!' : 'Share'}
                </NeonButton>
              </div>

              {/* QR + URL */}
              {shareUrl && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-4">
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="Visuals QR code"
                        className="w-20 h-20 rounded-lg bg-white p-1 flex-none"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-cyber text-zinc-400 uppercase tracking-widest mb-1">
                        Share URL (6h)
                      </p>
                      <p className="text-[10px] font-mono text-zinc-300 break-all leading-relaxed">
                        {shareUrl}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyUrl(shareUrl)}
                    className="text-[10px] font-cyber text-neon-cyan tracking-wider uppercase hover:underline self-start"
                  >
                    {copyDone ? '✓ Copied' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </NeonCard>

      {/* ── 2. Live call mosaic ───────────────────────────────────────── */}
      {roomState ? (
        <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-5">
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
      ) : null}

      {/* ── 3. Cue list ───────────────────────────────────────────────── */}
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
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

      {/* ── 4a. Visuals Mode ──────────────────────────────────────────── */}
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
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
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {VISUALS_MODES.map((m) => {
                  const active = m.id === workingState.mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id)}
                      disabled={!connected || !m.implemented}
                      title={m.description}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition-all duration-150',
                        active
                          ? 'border-neon-violet/50 bg-neon-violet/10 text-white'
                          : m.implemented
                            ? 'border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                            : 'border-white/5 text-zinc-600 cursor-not-allowed opacity-60'
                      )}
                      id={`visuals-mode-${m.id}`}
                    >
                      <span className="text-xs font-cyber">{m.label}</span>
                      {!m.implemented && (
                        <span className="text-[8px] font-cyber uppercase tracking-widest text-zinc-600">
                          Coming soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </NeonCard>

      {/* ── 4b. YouTube controls ──────────────────────────────────────── */}
      {workingState.mode === 'youtube' && (
        <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-5">
          <SectionHeader title="YOUTUBE" color="magenta" />
          <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
            {/* URL loader */}
            <div className="flex gap-2">
              <input
                type="text"
                value={ytUrlInput}
                onChange={(e) => setYtUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleYtLoad()}
                placeholder="Paste YouTube URL or video id…"
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-neon-magenta/50 focus:outline-none focus:ring-1 focus:ring-neon-magenta/50 font-cyber"
              />
              <NeonButton
                color="magenta"
                variant="solid"
                onClick={handleYtLoad}
                disabled={!connected || !ytUrlInput.trim()}
                className="text-xs uppercase tracking-widest h-9 px-4"
              >
                Load
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

            {/* Seek */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                Seek to
              </label>
              <input
                type="text"
                value={ytSeekInput}
                onChange={(e) => setYtSeekInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleYtSeek()}
                placeholder="mm:ss"
                className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center text-xs text-white placeholder-zinc-600 focus:border-neon-magenta/50 focus:outline-none font-cyber"
              />
              <NeonButton
                color="magenta"
                variant="outline"
                onClick={handleYtSeek}
                disabled={!connected || !ytSeekInput.trim()}
                className="text-xs uppercase tracking-widest h-8 px-3"
              >
                Go
              </NeonButton>
            </div>

            {/* Queue */}
            {ytQueue.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest">
                  Queue
                </p>
                {ytQueue.map((item, i) => (
                  <div
                    key={`${item.videoId}-${i}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2',
                      i === ytQueueIndex
                        ? 'border-neon-magenta/50 bg-neon-magenta/10'
                        : 'border-white/10 bg-black/30'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleYtQueueJump(i)}
                      disabled={!connected}
                      className="flex-1 text-left text-xs font-mono text-zinc-300 hover:text-white truncate"
                    >
                      {item.title || item.videoId}
                    </button>
                    {i === ytQueueIndex && (
                      <span className="text-[8px] font-cyber uppercase tracking-widest text-neon-magenta">
                        Now
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleYtQueueRemove(i)}
                      disabled={!connected}
                      className="text-zinc-600 hover:text-red-400 text-xs px-1"
                      aria-label="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </NeonCard>
      )}

      {/* ── 4c. 3D Visuals controls ───────────────────────────────────── */}
      {workingState.mode === '3d' && (
        <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
          <SectionHeader title="3D VISUALS — ENERGY ORB" color="cyan" />
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
                          : 'border-white/10 bg-black/30 text-zinc-500 hover:border-white/20 hover:text-zinc-300'
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
      )}

      {/* ── 4. Visual Art ─────────────────────────────────────────────── */}
      {workingState.mode === 'standard' && (
      <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-5">
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
                  return (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => handleArtChange(art.id)}
                      disabled={!connected}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150',
                        active
                          ? 'border-neon-magenta/50 bg-neon-magenta/10 text-white'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                      )}
                      id={`art-${art.id}`}
                    >
                      <span
                        className={cn(
                          'w-3 h-3 rounded-full mt-0.5 flex-none border',
                          active ? 'bg-neon-magenta border-neon-magenta' : 'border-white/20 bg-transparent'
                        )}
                      />
                      <div>
                        <p className="text-xs font-cyber">{art.label}</p>
                        {art.description && (
                          <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{art.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </NeonCard>
      )}

      {/* ── 5. Palette ────────────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => toggleCollapse('palette')}
        >
          <SectionHeader title="LIVE PALETTE" color="cyan" />
          <button className="text-zinc-400 hover:text-white p-1">
            {collapsedSections.palette ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.palette ? '0fr' : '1fr',
            transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-white/5">
              <PaletteEditor
                palette={workingState.palette}
                onChange={handlePaletteChange}
                disabled={!connected}
              />
            </div>
          </div>
        </div>
      </NeonCard>

      {/* ── 6. Show Name & Logo (Mix layout) ───────────────────────────── */}
      <div
        className={cn(
          'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
          workingState.logoEnabled
            ? 'border-neon-cyan/60 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse'
            : 'border-white/10 bg-black/30'
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

                {loadedRig?.logo_asset_path ? (
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
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
                    <p className="text-xs font-cyber text-muted-foreground tracking-wide">
                      No logo on this rig
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Upload a logo in the Rigs Manager to enable this toggle.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Live Custom Text Overlay (Mix layout) ───────────────────── */}
      <div
        className={cn(
          'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
          activeTextOverlay
            ? 'border-neon-violet/60 bg-neon-violet/5 shadow-[0_0_15px_rgba(176,38,255,0.25)] animate-pulse'
            : 'border-white/10 bg-black/30'
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

      {/* ── 8. Live QR Overlay (Mix layout) ────────────────────────────── */}
      <div
        className={cn(
          'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
          qrEnabled
            ? 'border-neon-cyan/60 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse'
            : 'border-white/10 bg-black/30'
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

      {/* ── 9. Rig ────────────────────────────────────────────────────── */}
      {mode !== 'operate' && (
        <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-5">
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
      )}
    </div>
  );
}
