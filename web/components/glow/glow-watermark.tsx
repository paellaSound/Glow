import { GLOW_BRAND_NAME, GLOW_LOGO_PATH } from '@/lib/glow/branding';
import { cn } from '@/lib/utils';

type GlowWatermarkProps = {
  /** Corner placement. Defaults to bottom-right. */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
};

const POSITION_CLASSES: Record<NonNullable<GlowWatermarkProps['position']>, string> = {
  'bottom-right': 'bottom-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'top-right': 'top-3 right-3',
  'top-left': 'top-3 left-3',
};

/**
 * Glow brand watermark shown on play devices & the visuals surface when the room's
 * plan does NOT include `removeWatermark` (Free / Party). Render conditionally:
 *   {!entitlements.removeWatermark ? <GlowWatermark /> : null}
 * Branding entitlement lives in the plan seed — see docs/plans.md.
 */
export function GlowWatermark({ position = 'bottom-right', className }: GlowWatermarkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-40 flex items-center gap-1.5 select-none',
        'rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-[2px]',
        'opacity-60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]',
        POSITION_CLASSES[position],
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={GLOW_LOGO_PATH} alt="" className="size-24 w-auto" />
      {/* <span className="text-[10px] font-cyber font-semibold uppercase tracking-widest text-white/90">
        {GLOW_BRAND_NAME}
      </span> */}
    </div>
  );
}
