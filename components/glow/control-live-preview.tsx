'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import { getVisualArt, type VisualArtId } from 'glow-visuals';
import {
  computeFallbackColor,
  computePresetColor,
  getPreset,
  type AudioFeatures,
} from 'glow-presets';
import { cn } from '@/lib/utils';

const PREVIEW_ROWS = 3;
const PREVIEW_COLS = 8;
const COLLAPSED_HEIGHT_PX = 56;
const IDLE_PREVIEW_PRESET = 'pulse';

type ControlLivePreviewProps = {
  activeTab: 'devices' | 'visuals';
  roomCode: string;
  activePresetId: string | null;
  presetSeed: number;
  devicePalette: string[];
  fallbackEnabled: boolean;
  fallbackSeed: number;
  artId?: string;
  visualPalette?: string[];
  logoEnabled?: boolean;
  logoUrl?: string | null;
};

function mockAudioFeatures(now: number): AudioFeatures {
  const t = now / 1000;
  return {
    bass: 0.35 + Math.sin(t * 8) * 0.25,
    mid: 0.3 + Math.cos(t * 6) * 0.2,
    treble: 0.25 + Math.sin(t * 14) * 0.15,
    energy: 0.4 + Math.sin(t * 4) * 0.2,
  };
}

export function ControlLivePreview({
  activeTab,
  roomCode,
  activePresetId,
  presetSeed,
  devicePalette,
  fallbackEnabled,
  fallbackSeed,
  artId,
  visualPalette = [],
  logoEnabled = false,
  logoUrl,
}: ControlLivePreviewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const presetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [statusLabel, setStatusLabel] = useState('Idle');

  useEffect(() => {
    if (collapsed || activeTab !== 'devices') return;

    const canvas = presetCanvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let cancelled = false;

    const syncCanvasSize = () => {
      const frame = previewFrameRef.current;
      if (!frame) return false;

      const width = Math.max(1, Math.floor(frame.clientWidth));
      const height = Math.max(1, Math.floor(frame.clientHeight));
      const dpr = window.devicePixelRatio || 1;
      const bufferWidth = Math.floor(width * dpr);
      const bufferHeight = Math.floor(height * dpr);

      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
        canvas.width = bufferWidth;
        canvas.height = bufferHeight;
      }

      return width > 1 && height > 1;
    };

    const tick = (now: number) => {
      if (cancelled) return;

      if (!syncCanvasSize()) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const frame = previewFrameRef.current!;
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      const cellWidth = width / PREVIEW_COLS;
      const cellHeight = height / PREVIEW_ROWS;

      const previewPresetId = fallbackEnabled
        ? null
        : activePresetId ?? IDLE_PREVIEW_PRESET;

      for (let row = 0; row < PREVIEW_ROWS; row++) {
        for (let col = 0; col < PREVIEW_COLS; col++) {
          let color = '#111111';

          if (fallbackEnabled) {
            color = computeFallbackColor(roomCode, fallbackSeed, row, col, now);
          } else if (previewPresetId) {
            color = computePresetColor(previewPresetId, {
              row,
              col,
              timeMs: now - presetSeed,
              seed: presetSeed,
              matrixRows: PREVIEW_ROWS,
              matrixCols: PREVIEW_COLS,
              palette: devicePalette,
              audio: previewPresetId === 'audio' ? mockAudioFeatures(now) : undefined,
            });
          }

          ctx.fillStyle = color;
          ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const observer = new ResizeObserver(() => {
      syncCanvasSize();
    });
    if (previewFrameRef.current) {
      observer.observe(previewFrameRef.current);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [
    collapsed,
    activeTab,
    roomCode,
    activePresetId,
    presetSeed,
    devicePalette,
    fallbackEnabled,
    fallbackSeed,
  ]);

  useEffect(() => {
    if (collapsed || activeTab !== 'visuals' || !visualCanvasRef.current || !artId) return;

    const canvas = visualCanvasRef.current;
    const definition = getVisualArt(artId as VisualArtId);
    if (!definition) return;

    let animationFrameId = 0;
    let cancelled = false;
    const startTime = Date.now();

    const mockInput = {
      timeMs: 0,
      palette: visualPalette.length > 0 ? visualPalette : ['#7c3aed', '#06b6d4'],
      roomCode,
      audio: {
        bass: 0.2,
        mid: 0.1,
        treble: 0.1,
        energy: 0.15,
      },
      logo:
        logoEnabled && logoUrl
          ? {
              url: logoUrl,
              opacity: 1,
              position: 'center' as const,
            }
          : null,
    };

    let controller: ReturnType<typeof definition.mount> | null = null;

    const mountWhenReady = () => {
      if (cancelled) return;

      const frame = previewFrameRef.current;
      if (!frame || frame.clientWidth < 2 || frame.clientHeight < 2) {
        animationFrameId = requestAnimationFrame(mountWhenReady);
        return;
      }

      controller = definition.mount(canvas, () => mockInput);
      controller.resize();

      const tick = () => {
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        mockInput.timeMs = elapsed;

        const t = elapsed / 1000;
        mockInput.audio = {
          bass: 0.2 + Math.sin(t * 8) * 0.15 + Math.cos(t * 15) * 0.05,
          mid: 0.2 + Math.cos(t * 6) * 0.15,
          treble: 0.1 + Math.sin(t * 14) * 0.1,
          energy: 0.15 + Math.sin(t * 4) * 0.1,
        };

        animationFrameId = requestAnimationFrame(tick);
      };

      tick();
    };

    mountWhenReady();

    const observer = new ResizeObserver(() => {
      controller?.resize();
    });
    if (previewFrameRef.current) {
      observer.observe(previewFrameRef.current);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      controller?.destroy();
    };
  }, [collapsed, activeTab, artId, visualPalette, roomCode, logoEnabled, logoUrl]);

  useEffect(() => {
    if (activeTab === 'visuals') {
      setStatusLabel(artId ? `Visual · ${artId}` : 'Visual · Idle');
      return;
    }

    if (fallbackEnabled) {
      setStatusLabel('Auto-Strobe');
      return;
    }

    if (activePresetId) {
      const preset = getPreset(activePresetId);
      setStatusLabel(preset?.label ?? activePresetId);
      return;
    }

    setStatusLabel('Palette Preview');
  }, [activeTab, artId, activePresetId, fallbackEnabled]);

  const accentColor = devicePalette[0] ?? visualPalette[0] ?? '#00FFCC';

  return (
    <div
      className={cn(
        'sticky top-0 z-30 mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[height] duration-300',
        collapsed ? 'h-14' : 'h-auto'
      )}
      style={collapsed ? { height: COLLAPSED_HEIGHT_PX } : undefined}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Smartphone className="size-4 shrink-0 text-neon-cyan" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-cyber uppercase tracking-widest text-neon-cyan">
              Live Preview
            </p>
            <p className="truncate text-[11px] font-cyber uppercase tracking-wider text-zinc-400">
              {statusLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
          aria-label={collapsed ? 'Expand preview' : 'Collapse preview'}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="p-3">
            <div
              ref={previewFrameRef}
              className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-black"
              style={{ aspectRatio: '19.5 / 9' }}
            >
              <canvas
                ref={presetCanvasRef}
                className={cn(
                  'absolute inset-0 size-full',
                  activeTab === 'devices' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
              />
              <canvas
                ref={visualCanvasRef}
                className={cn(
                  'absolute inset-0 size-full',
                  activeTab === 'visuals' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent"
                style={{ boxShadow: `inset 0 -8px 24px -8px ${accentColor}40` }}
              />
            </div>
            <p className="mt-2 text-center text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
              Mobile landscape · {activeTab === 'devices' ? 'Pattern output' : 'Visual surface'}
            </p>
          </div>
        </div>
      </div>

      {collapsed && (
        <div
          className="absolute inset-x-0 bottom-0 top-10 overflow-hidden"
          style={{
            background:
              (activeTab === 'devices' ? devicePalette : visualPalette).length > 1
                ? `linear-gradient(to right, ${(activeTab === 'devices' ? devicePalette : visualPalette).join(', ')})`
                : accentColor,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)]" />
        </div>
      )}
    </div>
  );
}
