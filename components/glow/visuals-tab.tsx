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
} from 'lucide-react';
import QRCode from 'qrcode';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { PaletteEditor } from '@/components/glow/palette-editor';
import { CueList, type RigCue } from '@/components/glow/cue-list';
import type { Socket } from 'socket.io-client';
import type { RoomStatePayload } from '@/lib/glow/types';
import { VISUAL_ART_REGISTRY } from 'glow-visuals';
import { LiveCallControls } from '@/components/glow/live-call-controls';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import { cn } from '@/lib/utils';
import { VisualsPreview } from '@/components/glow/visuals-preview';

// ── Types ──────────────────────────────────────────────────────────────────

export type VisualsWorkingState = {
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
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function rigLogoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/rig-logos/${path}`;
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, color = 'cyan' }: { title: string; color?: 'cyan' | 'violet' | 'magenta' }) {
  return (
    <NeonTitle as="h3" color={color} className="text-xs font-black tracking-widest mb-3">
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
    nextPos = qrPosition,
    nextSize = qrSize,
    nextInt = qrInterval,
    nextDur = qrDuration
  ) {
    const config = {
      enabled,
      position: nextPos,
      size: nextSize,
      intervalSeconds: nextPos === 'center' ? 0 : nextInt,
      durationSeconds: nextPos === 'center' ? 0 : nextDur,
    };
    socket.current?.emit('orchestrator:visuals_set_qr', {
      roomCode,
      qrConfig: config,
    });
    setActiveQrConfig(config);
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

  // Explicit type signature matching parent
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

  // Explicit type signature matching parent
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
      {/* ── 1. Output ──────────────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="OUTPUT SURFACE" color="cyan" />
          {surfaceConnected && (
            <span className="flex items-center gap-1.5 text-[9px] font-cyber text-neon-cyan tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
              Surface linked
            </span>
          )}
        </div>

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
      </NeonCard>

      {/* ── 2. Live call mosaic ───────────────────────────────────────── */}
      {roomState ? (
        <LiveCallControls
          roomCode={roomCode}
          roomState={roomState}
          entitlements={entitlements}
          socket={socket}
          connected={connected}
        />
      ) : null}

      {/* ── 3. Cue list ───────────────────────────────────────────────── */}
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
        <SectionHeader title="CUE LIST" color="violet" />
        <CueList
          cues={cues}
          cueIndex={workingState.cueIndex}
          onNext={handleNext}
          onPrev={handlePrev}
          onJump={handleJump}
          disabled={!connected}
        />
      </NeonCard>

      {/* ── 4. Visual Art ─────────────────────────────────────────────── */}
      <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-5">
        <SectionHeader title="VISUAL ART" color="magenta" />
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
      </NeonCard>

      {/* ── 5. Palette ────────────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <SectionHeader title="LIVE PALETTE" color="cyan" />
        <PaletteEditor
          palette={workingState.palette}
          onChange={handlePaletteChange}
          disabled={!connected}
        />
      </NeonCard>

      {/* ── 6. Show Name & Logo ────────────────────────────────────────── */}
      <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-5">
        <SectionHeader title="SHOW NAME & LOGO" color="cyan" />
        
        {/* Show Name input */}
        <div className="mb-4">
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
          <div className="flex items-center gap-4 border-t border-white/5 pt-4">
            {/* Preview */}
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

            {/* Toggle */}
            <button
              type="button"
              onClick={handleLogoToggle}
              disabled={!connected}
              className="flex-none flex flex-col items-center gap-1 disabled:opacity-40"
              aria-label={workingState.logoEnabled ? 'Hide logo' : 'Show logo'}
            >
              {workingState.logoEnabled ? (
                <ToggleRight className="w-8 h-8 text-neon-cyan" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-zinc-500" />
              )}
              <span className="text-[9px] font-cyber tracking-widest uppercase text-zinc-400">
                {workingState.logoEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
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
      </NeonCard>

      {/* ── 7. Live Custom Text Overlay ────────────────────────────────── */}
      <NeonCard glowColor="violet" borderVariant="violet" hoverEffect={false} className="p-5">
        <SectionHeader title="LIVE CUSTOM TEXT OVERLAY" color="violet" />
        <div className="space-y-4">
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
              <input
                type="range"
                min="1"
                max="20"
                value={textSpeed}
                onChange={(e) => setTextSpeed(Number(e.target.value))}
                className="w-full accent-neon-violet mt-2"
              />
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
              <input
                type="range"
                min="24"
                max="120"
                value={textFontSize}
                onChange={(e) => setTextFontSize(Number(e.target.value))}
                className="w-full accent-neon-violet mt-2"
              />
              <div className="text-[10px] font-cyber text-zinc-500 text-right mt-1">
                {textFontSize} px
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-cyber text-zinc-400 uppercase tracking-widest mb-1.5">
                Color Presets / Custom Hex
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
      </NeonCard>

      {/* ── 8. Live QR Overlay ─────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="LIVE QR OVERLAY" color="cyan" />
          <button
            type="button"
            onClick={() => {
              const next = !qrEnabled;
              setQrEnabled(next);
              handleQrUpdate(next);
            }}
            disabled={!connected}
            className="focus:outline-none"
          >
            {qrEnabled ? (
              <ToggleRight className="w-8 h-8 text-neon-cyan" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-zinc-500" />
            )}
          </button>
        </div>

        {qrEnabled && (
          <div className="space-y-4 animate-in fade-in duration-200">
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

            {qrPosition !== 'center' && (
              <div className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-3">
                <p className="text-[10px] font-cyber text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-1">
                  Periodic Visibility Timer
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-cyber text-zinc-500 uppercase tracking-widest mb-1">
                      Interval (sec)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={qrInterval}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setQrInterval(val);
                        handleQrUpdate(true, qrPosition, qrSize, val);
                      }}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                    />
                    <span className="text-[9px] text-zinc-600 block mt-0.5">
                      0 = Always visible
                    </span>
                  </div>
                  <div>
                    <label className="block text-[9px] font-cyber text-zinc-500 uppercase tracking-widest mb-1">
                      Duration (sec)
                    </label>
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
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-cyber"
                    />
                    <span className="text-[9px] text-zinc-600 block mt-0.5">
                      Show time during loop
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </NeonCard>

      {/* ── 9. Visuals Preview ────────────────────────────────────────── */}
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

      {/* ── 10. Rig ───────────────────────────────────────────────────── */}
      <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="RIG" color="cyan" />
          {workingState.dirty && (
            <span className="flex items-center gap-1.5 text-[9px] font-cyber text-amber-400 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
            </span>
          )}
        </div>

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
      </NeonCard>
    </div>
  );
}
