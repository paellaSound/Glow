'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Monitor,
  Pause,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  Smartphone,
} from 'lucide-react';
import {
  computeDistributionColor,
  computeFallbackColor,
  computePresetColor,
  getPreset,
  previewDeviceKey,
  type AudioFeatures,
} from 'glow-presets';
import {
  getActiveEffects,
  toDistributionEffects,
  type PatternSequenceDraft,
} from '@/lib/glow/pattern-sequences';
import { cn } from '@/lib/utils';

const PREVIEW_ROWS = 3;
const PREVIEW_COLS = 8;
const IDLE_PREVIEW_PRESET = 'pulse';

type ViewportMode = 'mobile' | 'desktop';
type Orientation = 'landscape' | 'portrait';

const VIEWPORT_BASE_RATIO: Record<ViewportMode, string> = {
  mobile: '19.5 / 9',
  desktop: '16 / 9',
};

function invertAspectRatio(ratio: string): string {
  const [width, height] = ratio.split('/').map((part) => part.trim());
  return `${height} / ${width}`;
}

function getAspectRatio(viewport: ViewportMode, orientation: Orientation): string {
  const base = VIEWPORT_BASE_RATIO[viewport];
  return orientation === 'landscape' ? base : invertAspectRatio(base);
}

function getRenderDimensions(viewport: ViewportMode, orientation: Orientation) {
  const [widthPart, heightPart] = getAspectRatio(viewport, orientation)
    .split('/')
    .map((part) => Number(part.trim()));

  return {
    width: 320,
    height: Math.max(1, Math.round((320 * heightPart) / widthPart)),
  };
}

function getViewportLabel(viewport: ViewportMode, orientation: Orientation): string {
  const device = viewport === 'mobile' ? 'Mobile' : 'Desktop';
  const layout = orientation === 'landscape' ? 'landscape' : 'portrait';
  return `${device} ${layout}`;
}

function mockAudioFeatures(now: number): AudioFeatures {
  const t = now / 1000;
  return {
    bass: 0.35 + Math.sin(t * 8) * 0.25,
    mid: 0.3 + Math.cos(t * 6) * 0.2,
    treble: 0.25 + Math.sin(t * 14) * 0.15,
    energy: 0.4 + Math.sin(t * 4) * 0.2,
  };
}

type IconToggleProps = {
  icons: [ComponentType<{ className?: string }>, ComponentType<{ className?: string }>];
  labels: [string, string];
  activeIndex: 0 | 1;
  onToggle: () => void;
  isActive?: boolean;
};

function IconToggle({ icons, labels, activeIndex, onToggle, isActive = false }: IconToggleProps) {
  const ActiveIcon = icons[activeIndex];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={labels[activeIndex]}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-white/20 hover:text-white',
        isActive && 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
      )}
    >
      <ActiveIcon className="size-4" />
    </button>
  );
}

export type PatternSequencePreviewProps = {
  draft: PatternSequenceDraft;
  previewEffectId?: string | null;
  liveName?: string | null;
  roomCode?: string;
  presetSeed?: number;
  fallbackEnabled?: boolean;
  fallbackSeed?: number;
};

export function PatternSequencePreview({
  draft,
  previewEffectId = null,
  liveName = null,
  roomCode = 'PREVIEW',
  presetSeed: presetSeedProp,
  fallbackEnabled = false,
  fallbackSeed = 0,
}: PatternSequencePreviewProps) {
  const [playing, setPlaying] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [viewport, setViewport] = useState<ViewportMode>('mobile');
  const [statusLabel, setStatusLabel] = useState('Preview');
  const playingRef = useRef(true);
  const presetSeedRef = useRef(presetSeedProp ?? Date.now());
  const presetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderFrameRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  const aspectRatio = getAspectRatio(viewport, orientation);
  const renderDimensions = getRenderDimensions(viewport, orientation);
  const viewportLabel = getViewportLabel(viewport, orientation);
  const accentColor = draft.palette[0] ?? '#00FFCC';
  const liveLabel = liveName ? `Live · ${liveName}` : 'Live · Nothing sent';
  const previewEffect = previewEffectId
    ? draft.effects.find((effect) => effect.id === previewEffectId) ?? null
    : null;
  const activeEffects = getActiveEffects(draft.effects);
  const isSplitPreview = activeEffects.length > 1 && !previewEffect;

  useEffect(() => {
    if (fallbackEnabled) {
      setStatusLabel('Auto-Strobe');
      return;
    }

    if (previewEffect) {
      const preset = getPreset(previewEffect.presetId);
      setStatusLabel(`Previewing · ${preset?.label ?? previewEffect.presetId}`);
      return;
    }

    if (isSplitPreview) {
      setStatusLabel(`Split preview · ${activeEffects.length} effects in mix`);
      return;
    }

    if (activeEffects.length === 1) {
      const preset = getPreset(activeEffects[0]!.presetId);
      setStatusLabel(`Previewing · ${preset?.label ?? activeEffects[0]!.presetId}`);
      return;
    }

    setStatusLabel(`Editing · ${draft.name}`);
  }, [draft.name, draft.effects, activeEffects, fallbackEnabled, isSplitPreview, previewEffect]);

  useEffect(() => {
    const canvas = presetCanvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let cancelled = false;

    const blitCanvas = () => {
      const source = presetCanvasRef.current;
      const target = displayCanvasRef.current;
      const frame = previewFrameRef.current;
      if (!source || !target || !frame) return;

      const width = Math.max(1, Math.floor(frame.clientWidth));
      const height = Math.max(1, Math.floor(frame.clientHeight));
      const dpr = window.devicePixelRatio || 1;
      const bufferWidth = Math.floor(width * dpr);
      const bufferHeight = Math.floor(height * dpr);

      if (target.width !== bufferWidth || target.height !== bufferHeight) {
        target.width = bufferWidth;
        target.height = bufferHeight;
      }

      const ctx = target.getContext('2d');
      if (!ctx || width < 1 || height < 1) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
    };

    const syncCanvasSize = () => {
      const frame = renderFrameRef.current;
      if (!frame) return false;

      const width = Math.max(1, Math.floor(frame.clientWidth));
      const height = Math.max(1, Math.floor(frame.clientHeight));
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      return width > 1 && height > 1;
    };

    const tick = (now: number) => {
      if (cancelled) return;

      if (!playingRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (!syncCanvasSize()) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const frame = renderFrameRef.current!;
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      const cellWidth = width / PREVIEW_COLS;
      const cellHeight = height / PREVIEW_ROWS;
      const seed = presetSeedRef.current;

      const distributionEffects = toDistributionEffects(draft.effects, draft.palette);
      const distribution =
        !previewEffect && activeEffects.length > 1
          ? {
              effects: distributionEffects,
              seedTimestamp: seed,
              targetTimestamp: seed,
              matrix: { rows: PREVIEW_ROWS, cols: PREVIEW_COLS },
            }
          : null;

      const soloEffect = previewEffect ?? (activeEffects.length === 1 ? activeEffects[0]! : null);
      const soloParams = soloEffect
        ? {
            ...soloEffect.params,
            palette: draft.palette,
            ...(soloEffect.presetId === 'audio'
              ? { audioSource: soloEffect.params?.audioSource ?? 'local' }
              : {}),
          }
        : undefined;

      for (let row = 0; row < PREVIEW_ROWS; row++) {
        for (let col = 0; col < PREVIEW_COLS; col++) {
          let color = '#111111';

          if (fallbackEnabled) {
            color = computeFallbackColor(roomCode, fallbackSeed, row, col, now);
          } else if (soloEffect && soloParams) {
            color = computePresetColor(soloEffect.presetId, {
              row,
              col,
              timeMs: now - seed,
              seed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: soloParams.palette,
              audio: soloEffect.presetId === 'audio' ? mockAudioFeatures(now) : undefined,
            });
          } else if (distribution) {
            color = computeDistributionColor(
              distribution,
              { row, col, timeMs: now - seed, audio: undefined },
              previewDeviceKey(row, col, PREVIEW_COLS)
            );
          } else if (distributionEffects[0]) {
            const effect = distributionEffects[0];
            color = computePresetColor(effect.presetId, {
              row,
              col,
              timeMs: now - seed,
              seed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: effect.params?.palette,
              audio: effect.presetId === 'audio' ? mockAudioFeatures(now) : undefined,
            });
          } else {
            color = computePresetColor(IDLE_PREVIEW_PRESET, {
              row,
              col,
              timeMs: now - seed,
              seed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: draft.palette,
            });
          }

          ctx.fillStyle = color;
          ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
        }
      }

      blitCanvas();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    draft,
    previewEffectId,
    roomCode,
    fallbackEnabled,
    fallbackSeed,
    renderDimensions.width,
    renderDimensions.height,
  ]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div
        ref={renderFrameRef}
        aria-hidden
        className="pointer-events-none fixed left-[-10000px] top-0 overflow-hidden opacity-0"
        style={{
          width: renderDimensions.width,
          height: renderDimensions.height,
        }}
      >
        <canvas ref={presetCanvasRef} className="absolute inset-0 size-full" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-cyber uppercase tracking-widest text-neon-cyan">
            Sequence preview
          </p>
          <p className="truncate text-[11px] font-cyber uppercase tracking-wider text-zinc-400">
            {statusLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-violet/30 bg-neon-violet/10 px-2 py-0.5 text-[9px] font-cyber uppercase tracking-wider text-neon-violet">
              <span className="size-1.5 rounded-full bg-neon-violet" />
              Canvas preview
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-cyber uppercase tracking-wider text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {liveLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-black/75 p-1">
          <IconToggle
            icons={[Pause, Play]}
            labels={['Pause preview', 'Play preview']}
            activeIndex={playing ? 0 : 1}
            onToggle={() => {
              playingRef.current = !playingRef.current;
              setPlaying(playingRef.current);
            }}
          />
          <IconToggle
            icons={[RectangleHorizontal, RectangleVertical]}
            labels={['Landscape preview', 'Portrait preview']}
            activeIndex={orientation === 'landscape' ? 0 : 1}
            onToggle={() =>
              setOrientation((value) => (value === 'landscape' ? 'portrait' : 'landscape'))
            }
            isActive={orientation === 'portrait'}
          />
          <IconToggle
            icons={[Smartphone, Monitor]}
            labels={['Mobile preview', 'Desktop preview']}
            activeIndex={viewport === 'mobile' ? 0 : 1}
            onToggle={() => setViewport((value) => (value === 'mobile' ? 'desktop' : 'mobile'))}
          />
        </div>
      </div>

      <div className="p-3">
        <div
          className="relative mx-auto w-full max-w-md"
          style={{ maxWidth: viewport === 'mobile' ? '20rem' : '100%' }}
        >
          <div
            ref={previewFrameRef}
            className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black"
            style={{ aspectRatio }}
          >
            <canvas ref={displayCanvasRef} className="absolute inset-0 size-full" />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent"
              style={{ boxShadow: `inset 0 -8px 24px -8px ${accentColor}40` }}
            />
          </div>
        </div>
        <p className="mt-2 text-center text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
          {viewportLabel} · {previewModeLabel(draft, previewEffectId)}
          {!playing ? ' · Paused' : ''}
        </p>
      </div>
    </div>
  );
}

function previewModeLabel(
  draft: PatternSequenceDraft,
  previewEffectId: string | null | undefined
): string {
  const previewEffect = previewEffectId
    ? draft.effects.find((effect) => effect.id === previewEffectId)
    : null;
  const activeEffects = getActiveEffects(draft.effects);

  if (previewEffect) {
    const label = getPreset(previewEffect.presetId)?.label ?? previewEffect.presetId;
    return `Single effect · ${label}`;
  }

  if (activeEffects.length > 1) {
    return 'Audience split preview';
  }

  return 'Pattern output';
}
