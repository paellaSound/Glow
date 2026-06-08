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
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export type VisualsWorkingState = {
  artId: string;
  palette: string[];
  logoEnabled: boolean;
  cueIndex: number;
  dirty: boolean;
  loadedRigId: string | null;
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
  const entitlements = roomState?.entitlements;
  const hasVisualsSurface = entitlements?.visualsSurface ?? false;

  // Output section state
  const [mintingToken, setMintingToken] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [surfaceConnected, setSurfaceConnected] = useState(false);

  // Rig overwrite state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Detect visuals:subscribed events via a socket listener
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    // We use a flag to know a surface is connected — the server doesn't send
    // "subscribed" to the orchestrator, but we can infer from emitting + getting a scene ack.
    // For now, show as connected if we have a surface token/url
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
      // The API may return an absolute URL (when BASE_URL is set) or a relative path.
      // Avoid double-prepending: only add origin when the url is relative.
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
    // Emit convenience event — server tracks index for replay
    socket.current?.emit('orchestrator:visuals_next_cue', { roomCode });
  }

  function handlePrev() {
    if (cues.length === 0) return;
    const prevIndex = (workingState.cueIndex - 1 + cues.length) % cues.length;
    const cue = cues[prevIndex];
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
    const cue = cues[index];
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
    <div className="flex flex-col gap-6">
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

      {/* ── 3. Visual Art ─────────────────────────────────────────────── */}
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

      {/* ── 4. Palette ────────────────────────────────────────────────── */}
      <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="p-5">
        <SectionHeader title="LIVE PALETTE" color="cyan" />
        <PaletteEditor
          palette={workingState.palette}
          onChange={handlePaletteChange}
          disabled={!connected}
        />
      </NeonCard>

      {/* ── 5. Logo ───────────────────────────────────────────────────── */}
      <NeonCard glowColor="none" borderVariant="default" hoverEffect={false} className="p-5">
        <SectionHeader title="LOGO" color="cyan" />
        {loadedRig?.logo_asset_path ? (
          <div className="flex items-center gap-4">
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

      {/* ── 6. Rig ────────────────────────────────────────────────────── */}
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
