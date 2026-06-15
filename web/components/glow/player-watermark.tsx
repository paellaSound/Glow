'use client';

import { FREE_PLAN_WATERMARK_TEXT } from '@/lib/glow/player-chrome-config';
import { cn } from '@/lib/utils';

type PlayerWatermarkProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Mandatory free-tier player watermark. Venue+ uses removeWatermark entitlement instead.
 */
export function PlayerWatermark({ className, style }: PlayerWatermarkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-30 select-none rounded-full',
        'bg-black/40 px-2.5 py-1 backdrop-blur-[2px]',
        'opacity-70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]',
        className
      )}
      style={style}
    >
      <span className="text-[10px] font-mono font-semibold lowercase tracking-wide text-white/90">
        {FREE_PLAN_WATERMARK_TEXT}
      </span>
    </div>
  );
}
