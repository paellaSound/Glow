'use client';

import { useRef } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlayerFlashButtonProps = {
  onPressStart: () => void;
  onPressEnd: () => void;
  active?: boolean;
  disabled?: boolean;
};

export function PlayerFlashButton({
  onPressStart,
  onPressEnd,
  active = false,
  disabled = false,
}: PlayerFlashButtonProps) {
  const holdingRef = useRef(false);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPressStart();
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPressEnd();
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Hold to flash"
      aria-pressed={active}
      className={cn(
        'fixed bottom-4 right-4 z-40 flex h-16 w-16 select-none items-center justify-center rounded-full border backdrop-blur-md transition-all duration-150 touch-none',
        'font-cyber text-[9px] uppercase tracking-widest',
        active
          ? 'border-white bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.8)] scale-105'
          : 'border-neon-cyan/50 bg-black/75 text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.35)] hover:shadow-[0_0_22px_rgba(0,229,255,0.5)]',
        disabled && 'pointer-events-none opacity-40'
      )}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex flex-col items-center gap-0.5">
        <Zap className={cn('h-5 w-5', active && 'text-black')} />
        <span>Flash</span>
      </div>
    </button>
  );
}
