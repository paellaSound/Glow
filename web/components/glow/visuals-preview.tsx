'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Monitor,
  Pause,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  Smartphone,
} from 'lucide-react';
import { getVisualArt } from 'glow-visuals';
import type { VisualArtController, VisualArtId, VisualArtInput } from 'glow-visuals';
import type { VisualsMode } from '@/lib/glow/types';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import { cn } from '@/lib/utils';
import { VisualsSequencedTextRenderer } from './visuals-sequenced-text-renderer';

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

export type VisualsPreviewProps = {
  mode?: VisualsMode;
  artId: string;
  palette: string[];
  displayName: string;
  logo: {
    url: string;
    opacity: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
    rect?: { x: number; y: number; width: number };
  } | null;
  editMode?: boolean;
  onLogoRectChange?: (rect: { x: number; y: number; width: number }) => void;
  text: {
    text: string;
    mode: 'marquee' | 'word_by_word' | 'spread_grid';
    speed: number;
    colorHex?: string;
    fontSize?: number;
    loop: boolean;
  } | null;
  qrConfig: {
    enabled: boolean;
    intervalSeconds: number;
    durationSeconds: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'small' | 'medium' | 'large';
  } | null;
  roomCode: string;
};

const MODE_PREVIEW_COPY: Partial<Record<VisualsMode, { title: string; hint: string }>> = {
  youtube: {
    title: 'YouTube preview',
    hint: 'Queue and transport appear after you push YouTube to the surface.',
  },
  '3d': {
    title: '3D preview',
    hint: 'Energy and actions drive the projector after you push 3D to the surface.',
  },
  'custom-video': {
    title: 'Custom video',
    hint: 'Coming soon — desk preview only.',
  },
  pptt: {
    title: 'PPTT mode',
    hint: 'Coming soon — desk preview only.',
  },
};

function presetToRect(
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
): { x: number; y: number; width: number } {
  switch (position) {
    case 'top-left':
      return { x: 4, y: 6, width: 18 };
    case 'top-right':
      return { x: 78, y: 6, width: 18 };
    case 'bottom-left':
      return { x: 4, y: 70, width: 18 };
    case 'bottom-right':
      return { x: 78, y: 70, width: 18 };
    default:
      return { x: 35, y: 35, width: 30 };
  }
}

const clampPct = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function VisualsPreview({
  mode = 'standard',
  artId,
  palette,
  displayName,
  logo,
  editMode = false,
  onLogoRectChange,
  text,
  qrConfig,
  roomCode,
}: VisualsPreviewProps) {
  const [playing, setPlaying] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const logoDragRef = useRef<{ mode: 'move' | 'resize' } | null>(null);

  const logoRect = logo?.url ? logo.rect ?? (editMode ? presetToRect(logo.position) : null) : null;
  const logoDraggable = editMode && Boolean(onLogoRectChange) && Boolean(logo?.url);

  const surfacePointerPercent = (clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const handleLogoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!logoDraggable) return;
    event.preventDefault();
    event.stopPropagation();
    logoDragRef.current = { mode: 'move' };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLogoResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!logoDraggable) return;
    event.preventDefault();
    event.stopPropagation();
    logoDragRef.current = { mode: 'resize' };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSurfacePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = logoDragRef.current;
    if (!drag || !onLogoRectChange || !logoRect) return;
    const pt = surfacePointerPercent(event.clientX, event.clientY);
    if (!pt) return;
    if (drag.mode === 'move') {
      onLogoRectChange({
        ...logoRect,
        x: clampPct(pt.x - logoRect.width / 2, 0, Math.max(0, 100 - logoRect.width)),
        y: clampPct(pt.y - logoRect.width / 2, 0, 96),
      });
    } else {
      onLogoRectChange({ ...logoRect, width: clampPct(pt.x - logoRect.x, 8, 80) });
    }
  };

  const handleSurfacePointerUp = () => {
    logoDragRef.current = null;
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<VisualArtController | null>(null);
  const inputRef = useRef<VisualArtInput>({
    timeMs: 0,
    palette,
    roomCode,
  });

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);

  // Sync state reference for visuals engine
  useEffect(() => {
    inputRef.current = {
      ...inputRef.current,
      palette,
      roomCode,
      logo,
    };
    controllerRef.current?.setInput(inputRef.current);
  }, [palette, roomCode, logo]);

  // Handle QR code generation
  useEffect(() => {
    const joinUrl = buildPlayerJoinUrl(roomCode, { matrix: false });
    QRCode.toDataURL(joinUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [roomCode]);

  // Periodic QR Code Overlay timer cycle for preview
  useEffect(() => {
    if (!qrConfig || !qrConfig.enabled) {
      setShowQrOverlay(false);
      return;
    }

    if (qrConfig.durationSeconds === 0) {
      setShowQrOverlay(true);
      return;
    }

    const intervalMs = qrConfig.intervalSeconds * 1000;
    const durationMs = qrConfig.durationSeconds * 1000;

    let showTimeout: NodeJS.Timeout;
    let hideTimeout: NodeJS.Timeout;

    const startCycle = () => {
      showTimeout = setTimeout(() => {
        setShowQrOverlay(true);
        hideTimeout = setTimeout(() => {
          setShowQrOverlay(false);
          startCycle();
        }, durationMs);
      }, intervalMs);
    };

    startCycle();

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [qrConfig]);

  // Mount/swap art
  const mountArt = useCallback((id: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    controllerRef.current?.destroy();
    controllerRef.current = null;

    const definition = getVisualArt(id);
    if (!definition) return;

    controllerRef.current = definition.mount(canvas, () => inputRef.current);
  }, []);

  // useLayoutEffect: canvas ref is set during commit, before this runs.
  useLayoutEffect(() => {
    mountArt(artId);
  }, [artId, mountArt]);

  // Tick animation loop
  useEffect(() => {
    if (!playing) return;

    let animationFrameId: number;
    let startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      inputRef.current.timeMs = elapsed;

      // Simulate audio pulses
      const t = elapsed / 1000;
      inputRef.current.audio = {
        bass: 0.2 + Math.sin(t * 8) * 0.15 + Math.cos(t * 15) * 0.05,
        mid: 0.2 + Math.cos(t * 6) * 0.15,
        treble: 0.1 + Math.sin(t * 14) * 0.1,
        energy: 0.15 + Math.sin(t * 4) * 0.1,
      };

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [playing]);

  // Clean up
  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
    };
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      controllerRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const aspectRatio = getAspectRatio(viewport, orientation);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-xs font-cyber tracking-widest text-zinc-400 uppercase">
          LIVE PREVIEW
        </h4>
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/20 hover:text-white"
            aria-label={playing ? 'Pause preview' : 'Play preview'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/* Orientation */}
          <button
            type="button"
            onClick={() => setOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/20 hover:text-white"
            aria-label="Toggle orientation"
          >
            {orientation === 'landscape' ? (
              <RectangleVertical className="h-4 w-4" />
            ) : (
              <RectangleHorizontal className="h-4 w-4" />
            )}
          </button>

          {/* Viewport type */}
          <button
            type="button"
            onClick={() => setViewport(viewport === 'mobile' ? 'desktop' : 'mobile')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/20 hover:text-white"
            aria-label="Toggle viewport type"
          >
            {viewport === 'mobile' ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Preview container */}
      <div className="flex items-center justify-center bg-black/90 p-4 rounded-xl min-h-[220px]">
        <div
          ref={surfaceRef}
          onPointerMove={editMode ? handleSurfacePointerMove : undefined}
          onPointerUp={editMode ? handleSurfacePointerUp : undefined}
          onPointerLeave={editMode ? handleSurfacePointerUp : undefined}
          className="relative max-w-full overflow-hidden border border-white/10 rounded-lg bg-black shadow-2xl transition-all duration-300"
          style={{
            aspectRatio,
            width: viewport === 'mobile' ? '120px' : '360px',
            maxWidth: '100%',
            touchAction: editMode ? 'none' : undefined,
          }}
        >
          {mode !== 'standard' ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950/80 via-black to-cyan-950/60 p-4 text-center">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-violet-200">
                Preview
              </span>
              <p className="text-[10px] font-cyber uppercase tracking-widest text-white">
                {MODE_PREVIEW_COPY[mode]?.title ?? mode}
              </p>
              <p className="text-[9px] text-zinc-400 leading-relaxed max-w-[200px]">
                {MODE_PREVIEW_COPY[mode]?.hint ?? 'Push this mode to the surface to go live.'}
              </p>
            </div>
          ) : null}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              mode !== 'standard' && 'opacity-20'
            )}
          />

          {/* Live Text Overlay */}
          {text && text.text && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden bg-muted/50">
              <div className="w-full h-full flex items-center justify-center p-1 text-center scale-[0.4] transform origin-center">
                <VisualsSequencedTextRenderer
                  text={text.text}
                  mode={text.mode}
                  speed={text.speed}
                  colorHex={text.colorHex}
                  loop={text.loop}
                  matrix={{ rows: 3, cols: 3 }}
                  fontSize={text.fontSize ? text.fontSize * 0.4 : undefined}
                />
              </div>
            </div>
          )}

          {/* Logo & Show Name */}
          {((logo && logo.url) || displayName) && (
            <div
              className={`absolute pointer-events-none z-10 transition-all duration-500 flex flex-col items-center gap-1 scale-[0.5] origin-center ${
                logo?.position === 'center' || (!logo && displayName)
                  ? 'inset-0 flex items-center justify-center'
                  : logo?.position === 'top-left'
                  ? 'top-2 left-2 items-start'
                  : logo?.position === 'top-right'
                  ? 'top-2 right-2 items-end'
                  : logo?.position === 'bottom-left'
                  ? 'bottom-2 left-2 items-start'
                  : 'bottom-2 right-2 items-end'
              }`}
              style={{ opacity: logo ? logo.opacity : 0.8 }}
            >
              {logo && logo.url && !logoRect && (
                <img
                  src={logo.url}
                  alt="Logo preview"
                  className={cn(
                    'object-contain w-8 h-8',
                    logo.effect === 'pulse' && 'animate-pulse',
                    logo.effect === 'spin' && 'animate-[spin_8s_linear_infinite]',
                    logo.effect === 'float' && 'animate-bounce',
                    logo.effect === 'neon' && 'brightness-125 shadow-lg'
                  )}
                />
              )}
              {displayName && (
                <span className="font-cyber font-black tracking-wider text-[8px] uppercase text-white neon-text-cyan leading-none text-center">
                  {displayName}
                </span>
              )}
            </div>
          )}

          {/* Free-placed logo layer (drag to move, corner to resize in edit mode) */}
          {logo?.url && logoRect && (
            <div
              className={cn('absolute z-20', logoDraggable && 'cursor-move')}
              style={{
                left: `${logoRect.x}%`,
                top: `${logoRect.y}%`,
                width: `${logoRect.width}%`,
                opacity: logo.opacity,
                touchAction: editMode ? 'none' : undefined,
              }}
              onPointerDown={logoDraggable ? handleLogoPointerDown : undefined}
            >
              <img
                src={logo.url}
                alt="Logo preview"
                draggable={false}
                className={cn(
                  'pointer-events-none h-auto w-full object-contain',
                  logo.effect === 'pulse' && 'animate-pulse',
                  logo.effect === 'spin' && 'animate-[spin_8s_linear_infinite]',
                  logo.effect === 'float' && 'animate-bounce',
                  logo.effect === 'neon' && 'brightness-125'
                )}
              />
              {editMode ? (
                <div className="pointer-events-none absolute inset-0 rounded outline outline-1 outline-neon-violet/60" />
              ) : null}
              {logoDraggable ? (
                <button
                  type="button"
                  aria-label="Resize logo"
                  onPointerDown={handleLogoResizePointerDown}
                  className="absolute -bottom-1.5 -right-1.5 size-3 touch-none rounded-full border border-white bg-neon-violet"
                />
              ) : null}
            </div>
          )}

          {/* QR Overlay */}
          {showQrOverlay && qrDataUrl && (
            qrConfig?.position && qrConfig.position !== 'center' ? (
              <div
                className={cn(
                  'absolute z-20 p-1 rounded border border-neon-magenta/25 bg-black/80 flex flex-col items-center gap-0.5 scale-[0.5] origin-center',
                  qrConfig.position === 'top-left' && 'top-1 left-1',
                  qrConfig.position === 'top-right' && 'top-1 right-1',
                  qrConfig.position === 'bottom-left' && 'bottom-1 left-1',
                  qrConfig.position === 'bottom-right' && 'bottom-1 right-1'
                )}
              >
                <img
                  src={qrDataUrl}
                  alt="QR code"
                  className={cn(
                    'rounded border border-white bg-white',
                    qrConfig.size === 'small' ? 'w-6 h-6' : qrConfig.size === 'large' ? 'w-14 h-14' : 'w-10 h-10'
                  )}
                />
                <span className="font-cyber font-black text-[5px] text-neon-cyan leading-none">
                  ROOM: {roomCode}
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[1px] p-2">
                <div className="p-2 rounded-xl border border-neon-magenta/30 bg-black/85 flex flex-col items-center gap-1 scale-[0.6]">
                  <img
                    src={qrDataUrl}
                    alt="QR Code Centered"
                    className={cn(
                      'rounded border border-white bg-white',
                      qrConfig?.size === 'small' ? 'w-12 h-12' : qrConfig?.size === 'large' ? 'w-24 h-24' : 'w-18 h-18'
                    )}
                  />
                  <span className="font-cyber font-black text-[6px] text-white tracking-widest leading-none">
                    ROOM: {roomCode}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
