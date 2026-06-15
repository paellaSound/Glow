'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVisualEngine } from '@/lib/glow/visual-engine';
import { toDistributionEffects, type PatternSequenceDraft } from '@/lib/glow/pattern-sequences';
import {
  getUserLogoLayer,
  isPlayerMenuItemVisible,
  shouldShowFlashButton,
  shouldShowPlayerWatermark,
  shouldShowReactionsToolbar,
  shouldShowSyncDelay,
  shouldShowUserLogo,
  type PlayerChromeConfig,
  type PlayerChromeUserLogoLayer,
} from '@/lib/glow/player-chrome-config';
import type { PlanEntitlements } from '@/lib/glow/types';
import { PlayerLogoOverlay } from '@/components/glow/player-logo-overlay';
import { PlayerWatermark } from '@/components/glow/player-watermark';
import { cn } from '@/lib/utils';
import { EMOJI_GLYPHS, REACTION_ALLOWLIST_FREE } from 'glow-visuals';
import { Maximize2, MoreHorizontal, QrCode, Share2, Zap } from 'lucide-react';

export type PlayerChromePreviewProps = {
  backgroundColor?: string;
  playerChrome: PlayerChromeConfig;
  entitlements: PlanEntitlements;
  logoUrl?: string | null;
  editMode?: boolean;
  onUserLogoChange?: (layer: PlayerChromeUserLogoLayer) => void;
  /** Live pattern draft — when present, the background animates via the real visual engine. */
  draft?: PatternSequenceDraft | null;
  className?: string;
};

export function PlayerChromePreview({
  backgroundColor = '#1a0533',
  playerChrome,
  entitlements,
  logoUrl = null,
  editMode = false,
  onUserLogoChange,
  draft = null,
  className,
}: PlayerChromePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const visual = useVisualEngine({ row: 0, col: 0 });
  const scheduleRef = useRef(visual.scheduleEffectDistribution);
  scheduleRef.current = visual.scheduleEffectDistribution;

  const previewEffects = useMemo(() => {
    if (!draft) return [];
    const raw = toDistributionEffects(draft.effects, draft.palette);
    // Map audio-reactive effects to the orchestrator source so the preview never
    // prompts for the operator's microphone; they render without live audio.
    return raw.map((effect) =>
      effect.presetId === 'audio'
        ? { ...effect, params: { ...(effect.params ?? {}), audioSource: 'orchestrator' as const } }
        : effect
    );
  }, [draft]);

  useEffect(() => {
    if (!previewEffects.length) return;
    const now = Date.now();
    scheduleRef.current({
      effects: previewEffects,
      seedTimestamp: now,
      targetTimestamp: now,
      matrix: { rows: 1, cols: 1 },
    });
  }, [previewEffects]);

  const liveBackground = previewEffects.length ? visual.color : backgroundColor;
  const [selectedLayer, setSelectedLayer] = useState<'userLogo' | null>(editMode ? 'userLogo' : null);
  const dragRef = useRef<{ startX: number; startY: number; origin: PlayerChromeUserLogoLayer } | null>(
    null
  );
  const resizeRef = useRef<{ startX: number; originWidth: number } | null>(null);

  const userLogoLayer = getUserLogoLayer(playerChrome);
  const showWatermark = shouldShowPlayerWatermark(entitlements, logoUrl, userLogoLayer.visible);
  const showLogo = shouldShowUserLogo(entitlements, logoUrl, userLogoLayer);
  const showReactions = shouldShowReactionsToolbar(playerChrome, entitlements);
  const showFlash = shouldShowFlashButton(playerChrome);
  const showDelay = shouldShowSyncDelay(playerChrome);
  const showHudShare = isPlayerMenuItemVisible(playerChrome, 'share-link');
  const showHudQr = isPlayerMenuItemVisible(playerChrome, 'qr-code');
  const showHudFullscreen = isPlayerMenuItemVisible(playerChrome, 'fullscreen');
  // More button is derived: it shows when the HUD sheet has reachable content.
  const showHudMore =
    isPlayerMenuItemVisible(playerChrome, 'flash-effects') ||
    isPlayerMenuItemVisible(playerChrome, 'exit-rave');
  const hasHudToolbar = showHudShare || showHudQr || showHudFullscreen || showHudMore;

  const updateLayer = useCallback(
    (patch: Partial<PlayerChromeUserLogoLayer>) => {
      if (!onUserLogoChange) return;
      onUserLogoChange({ ...userLogoLayer, ...patch });
    },
    [onUserLogoChange, userLogoLayer]
  );

  const pointerToPercent = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleLogoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || !onUserLogoChange) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayer('userLogo');
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: userLogoLayer,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && onUserLogoChange) {
      const pt = pointerToPercent(event.clientX, event.clientY);
      if (!pt) return;
      updateLayer({
        x: Math.min(95, Math.max(5, pt.x)),
        y: Math.min(95, Math.max(5, pt.y)),
      });
    }
    if (resizeRef.current && onUserLogoChange) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const delta = ((event.clientX - resizeRef.current.startX) / rect.width) * 100;
      updateLayer({
        width: Math.min(60, Math.max(8, resizeRef.current.originWidth + delta)),
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={containerRef}
        className={cn(
          'control-live-preview-shell-enter relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.75rem] border shadow-lg',
          editMode ? 'border-neon-violet/40' : 'border-white/15',
          'bg-black'
        )}
        style={{ aspectRatio: '19.5 / 9' }}
        onPointerMove={editMode ? handlePointerMove : undefined}
        onPointerUp={editMode ? handlePointerUp : undefined}
        onPointerLeave={editMode ? handlePointerUp : undefined}
        onClick={() => {
          if (editMode) setSelectedLayer(null);
        }}
      >
        <div className="absolute inset-[10px] overflow-hidden rounded-[1.25rem]">
          <div className="absolute inset-0" style={{ backgroundColor: liveBackground }} />

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-2">
            <span className="rounded bg-black/40 px-2 py-0.5 text-[8px] text-white/80">
              live{showDelay ? ' (85ms)' : ''}
            </span>
            {hasHudToolbar ? (
              <div className="flex items-center gap-0.5 rounded-full border border-neon-cyan/30 bg-black/60 px-1 py-0.5">
                {showHudShare ? <Share2 className="size-2.5 text-zinc-400" /> : null}
                {showHudQr ? <QrCode className="size-2.5 text-zinc-400" /> : null}
                {showHudFullscreen ? <Maximize2 className="size-2.5 text-zinc-400" /> : null}
                {showHudMore ? <MoreHorizontal className="size-2.5 text-zinc-400" /> : null}
              </div>
            ) : null}
          </div>

          {showWatermark ? (
            <PlayerWatermark
              className="bottom-2 right-2"
              style={{ left: 'auto', top: 'auto' }}
            />
          ) : null}

          {showLogo && logoUrl ? (
            <>
              <PlayerLogoOverlay
                url={logoUrl}
                layer={userLogoLayer}
                editable={editMode && Boolean(onUserLogoChange)}
                selected={editMode && selectedLayer === 'userLogo'}
                onPointerDown={handleLogoPointerDown}
              />
              {editMode && selectedLayer === 'userLogo' && onUserLogoChange ? (
                <button
                  type="button"
                  aria-label="Resize logo"
                  className="absolute z-30 size-3 rounded-full border border-white bg-neon-violet touch-none"
                  style={{
                    left: `${userLogoLayer.x}%`,
                    top: `${userLogoLayer.y}%`,
                    transform: 'translate(40%, 40%)',
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    resizeRef.current = {
                      startX: event.clientX,
                      originWidth: userLogoLayer.width,
                    };
                    (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
                  }}
                />
              ) : null}
            </>
          ) : null}

          {showReactions ? (
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neon-cyan/30 bg-black/70 px-2 py-1">
              {REACTION_ALLOWLIST_FREE.slice(0, 4).map((emoji) => (
                <span key={emoji} className="text-sm leading-none">
                  {EMOJI_GLYPHS[emoji]}
                </span>
              ))}
            </div>
          ) : null}

          {showFlash ? (
            <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex size-10 flex-col items-center justify-center rounded-full border border-neon-cyan/40 bg-black/70 text-[6px] font-cyber uppercase tracking-wider text-neon-cyan">
              <Zap className="size-3.5" />
            </div>
          ) : null}
        </div>
      </div>

      {editMode ? (
        <p className="px-1 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
          {entitlements.customRigLogo && logoUrl
            ? 'Drag logo · violet handle to resize'
            : 'Free & Party show the glowtherave.com watermark'}
        </p>
      ) : (
        <p className="text-center text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
          Player preview
        </p>
      )}
    </div>
  );
}
