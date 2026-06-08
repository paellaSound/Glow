'use client';

import { useMemo, useRef } from 'react';
import { getPreset } from 'glow-presets';
import type { PatternSequenceEffect } from '@/lib/glow/pattern-sequences';
import { cn } from '@/lib/utils';

type AllocationBarProps = {
  effects: PatternSequenceEffect[];
  onChange: (effects: PatternSequenceEffect[]) => void;
  disabled?: boolean;
};

const SEGMENT_COLORS = [
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
];

function getPrefixSum(effects: PatternSequenceEffect[], index: number): number {
  return effects.slice(0, index).reduce((sum, effect) => sum + effect.weight, 0);
}

function applyPairWeights(
  effects: PatternSequenceEffect[],
  leftId: string,
  rightId: string,
  leftWeight: number,
  rightWeight: number
): PatternSequenceEffect[] {
  return effects.map((effect) => {
    if (effect.id === leftId) return { ...effect, weight: leftWeight };
    if (effect.id === rightId) return { ...effect, weight: rightWeight };
    return effect;
  });
}

export function AllocationBar({ effects, onChange, disabled = false }: AllocationBarProps) {
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  const activeEffects = useMemo(
    () => effects.filter((effect) => effect.active),
    [effects]
  );

  if (activeEffects.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Activate at least one effect to configure audience split.
      </p>
    );
  }

  if (activeEffects.length === 1) {
    const effect = activeEffects[0]!;
    const label = getPreset(effect.presetId)?.label ?? effect.presetId;
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
          Audience split
        </p>
        <p className="mt-1 text-sm text-foreground">
          {label} · 100% of screens
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
          Audience split (always 100%)
        </p>
        <span className="text-[10px] font-cyber uppercase tracking-wider text-neon-cyan">
          {activeEffects.reduce((sum, e) => sum + e.weight, 0)}%
        </span>
      </div>

      <div className="relative h-10 overflow-hidden rounded-lg border border-white/10 bg-black/30">
        <div className="flex h-full">
          {activeEffects.map((effect, index) => (
            <div
              key={effect.id}
              className={cn(
                'relative flex h-full items-center justify-center text-[10px] font-cyber uppercase tracking-wider text-white',
                SEGMENT_COLORS[index % SEGMENT_COLORS.length]
              )}
              style={{ width: `${effect.weight}%` }}
            >
              <span className="truncate px-1">
                {getPreset(effect.presetId)?.label ?? effect.presetId} {effect.weight}%
              </span>
            </div>
          ))}
        </div>

        {activeEffects.slice(0, -1).map((effect, index) => {
          const handleLeft =
            getPrefixSum(activeEffects, index) + activeEffects[index]!.weight;

          return (
            <button
              key={`handle-${effect.id}`}
              type="button"
              disabled={disabled}
              aria-label={`Adjust split between effect ${index + 1} and ${index + 2}`}
              className="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border border-white/40 bg-white/80 shadow"
              style={{ left: `${handleLeft}%` }}
              onPointerDown={(event) => {
                if (disabled) return;

                event.preventDefault();
                const handle = event.currentTarget;
                handle.setPointerCapture(event.pointerId);

                const bar = handle.parentElement;
                if (!bar) return;

                const barRect = bar.getBoundingClientRect();
                const startX = event.clientX;
                const currentActive = effectsRef.current.filter((item) => item.active);
                const leftEffect = currentActive[index];
                const rightEffect = currentActive[index + 1];
                if (!leftEffect || !rightEffect) return;

                const startLeft = leftEffect.weight;
                const pairTotal = startLeft + rightEffect.weight;

                const move = (moveEvent: PointerEvent) => {
                  const deltaPercent = ((moveEvent.clientX - startX) / barRect.width) * 100;
                  const newLeft = Math.max(
                    1,
                    Math.min(pairTotal - 1, Math.round(startLeft + deltaPercent))
                  );
                  const newRight = pairTotal - newLeft;

                  const latestActive = effectsRef.current.filter((item) => item.active);
                  const latestLeft = latestActive[index];
                  const latestRight = latestActive[index + 1];
                  if (
                    !latestLeft ||
                    !latestRight ||
                    (latestLeft.weight === newLeft && latestRight.weight === newRight)
                  ) {
                    return;
                  }

                  onChange(
                    applyPairWeights(
                      effectsRef.current,
                      leftEffect.id,
                      rightEffect.id,
                      newLeft,
                      newRight
                    )
                  );
                };

                const up = (upEvent: PointerEvent) => {
                  handle.releasePointerCapture(upEvent.pointerId);
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                  window.removeEventListener('pointercancel', up);
                };

                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
                window.addEventListener('pointercancel', up);
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {activeEffects.map((effect, index) => (
          <span
            key={effect.id}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground"
          >
            <span
              className={cn('size-2 rounded-full', SEGMENT_COLORS[index % SEGMENT_COLORS.length])}
            />
            {getPreset(effect.presetId)?.label ?? effect.presetId} · {effect.weight}%
          </span>
        ))}
      </div>
    </div>
  );
}
