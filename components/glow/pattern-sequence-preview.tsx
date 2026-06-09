'use client';

import { useEffect, useRef, useState, useMemo, type ComponentType } from 'react';
import {
  Monitor,
  Pause,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  Smartphone,
  Layers,
  Tv,
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
  const [previewMode, setPreviewMode] = useState<'split' | 'device'>('split');
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
      if (previewMode === 'device') {
        setStatusLabel(`Device preview · 1 assigned effect`);
      } else {
        setStatusLabel(`Split preview · ${activeEffects.length} effects in mix`);
      }
      return;
    }

    if (activeEffects.length === 1) {
      const preset = getPreset(activeEffects[0]!.presetId);
      setStatusLabel(`Previewing · ${preset?.label ?? activeEffects[0]!.presetId}`);
      return;
    }

    setStatusLabel(`Editing · ${draft.name}`);
  }, [draft.name, draft.effects, activeEffects, fallbackEnabled, isSplitPreview, previewEffect, previewMode]);

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

      const displayRows = previewMode === 'device' ? 1 : PREVIEW_ROWS;
      const displayCols = previewMode === 'device' ? 1 : PREVIEW_COLS;
      const cellWidth = width / displayCols;
      const cellHeight = height / displayRows;

      for (let row = 0; row < displayRows; row++) {
        for (let col = 0; col < displayCols; col++) {
          let color = '#111111';
          const targetRow = previewMode === 'device' ? 0 : row;
          const targetCol = previewMode === 'device' ? 0 : col;

          if (fallbackEnabled) {
            color = computeFallbackColor(roomCode, fallbackSeed, targetRow, targetCol, now);
          } else if (soloEffect && soloParams) {
            color = computePresetColor(soloEffect.presetId, {
              row: targetRow,
              col: targetCol,
              timeMs: now - seed,
              seed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: soloParams.palette,
              audio: soloEffect.presetId === 'audio' ? mockAudioFeatures(now) : undefined,
            });
          } else if (distribution) {
            const deviceKey = previewMode === 'device'
              ? previewDeviceKey(0, 0, PREVIEW_COLS)
              : previewDeviceKey(row, col, PREVIEW_COLS);
            color = computeDistributionColor(
              distribution,
              { row: targetRow, col: targetCol, timeMs: now - seed, audio: mockAudioFeatures(now) },
              deviceKey
            );
          } else if (distributionEffects[0]) {
            const effect = distributionEffects[0];
            color = computePresetColor(effect.presetId, {
              row: targetRow,
              col: targetCol,
              timeMs: now - seed,
              seed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: effect.params?.palette,
              audio: effect.presetId === 'audio' ? mockAudioFeatures(now) : undefined,
            });
          } else {
            color = computePresetColor(IDLE_PREVIEW_PRESET, {
              row: targetRow,
              col: targetCol,
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
    previewMode,
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
            {/* <span className="inline-flex items-center gap-1 rounded-full border border-neon-violet/30 bg-neon-violet/10 px-2 py-0.5 text-[9px] font-cyber uppercase tracking-wider text-neon-violet">
              <span className="size-1.5 rounded-full bg-neon-violet" />
              Room Space Preview
            </span> */}
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-cyber uppercase tracking-wider",
              previewMode === 'device'
                ? "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan"
                : "border-neon-violet/30 bg-neon-violet/10 text-neon-violet"
            )}>
              <span className={cn("size-1.5 rounded-full", previewMode === 'device' ? "bg-neon-cyan" : "bg-neon-violet")} />
              {previewMode === 'device' ? 'Single Device View' : 'Group View'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-cyber uppercase tracking-wider text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {liveLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-black/75 p-1">
          <IconToggle
            icons={[Layers, Tv]}
            labels={['Group View (Room)', 'Single Device View (Phone)']}
            activeIndex={previewMode === 'split' ? 0 : 1}
            onToggle={() =>
              setPreviewMode((value) => (value === 'split' ? 'device' : 'split'))
            }
            isActive={previewMode === 'device'}
          />
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
            
            {/* Media Overlay Layer */}
            {draft.media && draft.media.active && (
              <div className="absolute inset-0 z-5 pointer-events-none flex items-center justify-center overflow-hidden bg-black/20">
                {draft.media.kind === 'gif' && draft.media.gifUrl && (
                  <img
                    src={draft.media.gifUrl}
                    alt="Preview GIF"
                    className="w-full h-full object-contain"
                  />
                )}
                {draft.media.kind === 'text' && draft.media.text && (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <SequencedTextRenderer
                      text={draft.media.text}
                      mode={draft.media.mode || 'marquee'}
                      speed={draft.media.speed || 5}
                      colorHex={draft.media.colorHex || '#ffffff'}
                      loop={draft.media.loop ?? true}
                      fontSize={draft.media.fontSize ? draft.media.fontSize * 0.45 : undefined} // Scaled down for preview size
                      matrix={{ rows: PREVIEW_ROWS, cols: PREVIEW_COLS }}
                      row={previewMode === 'device' ? 0 : 1} // center row for preview grid
                      col={previewMode === 'device' ? 0 : 3} // center col for preview grid
                    />
                  </div>
                )}
              </div>
            )}

            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent"
              style={{ boxShadow: `inset 0 -8px 24px -8px ${accentColor}40` }}
            />
          </div>
        </div>
        <p className="mt-2 text-center text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
          {viewportLabel} · {previewModeLabel(draft, previewEffectId, previewMode)}
          {!playing ? ' · Paused' : ''}
        </p>
      </div>
    </div>
  );
}

function previewModeLabel(
  draft: PatternSequenceDraft,
  previewEffectId: string | null | undefined,
  previewMode?: 'split' | 'device'
): string {
  if (previewMode === 'device') {
    return 'Single Device Screen';
  }

  const previewEffect = previewEffectId
    ? draft.effects.find((effect) => effect.id === previewEffectId)
    : null;
  const activeEffects = getActiveEffects(draft.effects);

  if (previewEffect) {
    const label = getPreset(previewEffect.presetId)?.label ?? previewEffect.presetId;
    return `Room Layout · ${label}`;
  }

  if (activeEffects.length > 1) {
    return 'Room Layout · Split View';
  }

  return 'Room Layout · Pattern output';
}

type SequencedTextRendererProps = {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  speed: number;
  colorHex?: string;
  loop: boolean;
  row?: number;
  col?: number;
  matrix: { rows: number; cols: number };
  fontSize?: number;
};

function SequencedTextRenderer({
  text,
  mode,
  speed,
  colorHex = '#ffffff',
  loop,
  row,
  col,
  matrix,
  fontSize,
}: SequencedTextRendererProps) {
  const [wordIdx, setWordIdx] = useState(0);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  // Handle word_by_word mode
  useEffect(() => {
    if (mode !== 'word_by_word' || words.length === 0) return;
    setWordIdx(0);
    const interval = setInterval(() => {
      setWordIdx((prev) => {
        if (prev + 1 >= words.length) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / Math.max(0.1, speed));
    return () => clearInterval(interval);
  }, [words, speed, loop, mode]);

  // Handle spread_grid mode
  const gridWord = useMemo(() => {
    if (mode !== 'spread_grid' || row === undefined || col === undefined || words.length === 0) {
      return null;
    }
    const cellIndex = row * matrix.cols + col;
    const pageSize = matrix.rows * matrix.cols;
    const numPages = Math.ceil(words.length / pageSize);
    const pageDurationMs = (pageSize / Math.max(0.1, speed)) * 1000;
    
    return { cellIndex, pageSize, numPages, pageDurationMs };
  }, [mode, row, col, words.length, matrix.rows, matrix.cols, speed]);

  const [gridPage, setGridPage] = useState(0);

  useEffect(() => {
    if (!gridWord) return;
    setGridPage(0);
    const interval = setInterval(() => {
      setGridPage((prev) => {
        if (prev + 1 >= gridWord.numPages) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, gridWord.pageDurationMs);
    return () => clearInterval(interval);
  }, [gridWord, loop]);

  if (mode === 'marquee') {
    const duration = Math.max(3, text.length / Math.max(1, speed));
    return (
      <div className="w-full whitespace-nowrap overflow-hidden">
        <span
          className={cn(
            "inline-block font-cyber font-black tracking-widest uppercase",
            !fontSize && "text-[20px]"
          )}
          style={{
            color: colorHex,
            fontSize: fontSize ? `${fontSize}px` : undefined,
            animation: `marquee ${duration}s linear ${loop ? 'infinite' : '1'}`,
          }}
        >
          {text}
        </span>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    );
  }

  if (mode === 'word_by_word') {
    const currentWord = words[wordIdx] || '';
    return (
      <span
        className={cn(
          "font-cyber font-black tracking-widest uppercase",
          !fontSize && "text-[24px]"
        )}
        style={{
          color: colorHex,
          fontSize: fontSize ? `${fontSize}px` : undefined,
        }}
        key={wordIdx}
      >
        {currentWord}
      </span>
    );
  }

  if (mode === 'spread_grid') {
    if (row === undefined || col === undefined) {
      const duration = Math.max(3, text.length / Math.max(1, speed));
      return (
        <div className="w-full whitespace-nowrap overflow-hidden">
          <span
            className={cn(
              "inline-block font-cyber font-black tracking-widest uppercase",
              !fontSize && "text-[20px]"
            )}
            style={{
              color: colorHex,
              fontSize: fontSize ? `${fontSize}px` : undefined,
              animation: `marquee ${duration}s linear ${loop ? 'infinite' : '1'}`,
            }}
          >
            {text}
          </span>
        </div>
      );
    }

    if (!gridWord) return null;
    const wordIndex = gridPage * gridWord.pageSize + gridWord.cellIndex;
    const currentWord = words[wordIndex] || '';

    return (
      <span
        className={cn(
          "font-cyber font-black tracking-widest uppercase",
          !fontSize && "text-[24px]"
        )}
        style={{
          color: colorHex,
          fontSize: fontSize ? `${fontSize}px` : undefined,
        }}
        key={wordIndex}
      >
        {currentWord}
      </span>
    );
  }

  return null;
}
