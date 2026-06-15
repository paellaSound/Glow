'use client';

import type { PlayerChromeUserLogoLayer } from '@/lib/glow/player-chrome-config';
import { cn } from '@/lib/utils';

type PlayerLogoOverlayProps = {
  url: string;
  layer: PlayerChromeUserLogoLayer;
  editable?: boolean;
  selected?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
};

export function PlayerLogoOverlay({
  url,
  layer,
  editable = false,
  selected = false,
  onPointerDown,
  className,
}: PlayerLogoOverlayProps) {
  if (!layer.visible) return null;

  const opacity = layer.opacity ?? 0.92;

  return (
    <div
      className={cn(
        'absolute z-20',
        editable && 'cursor-move touch-none',
        editable && selected && 'ring-2 ring-neon-violet/80 ring-offset-1 ring-offset-black/40',
        className
      )}
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width}%`,
        height: layer.height ? `${layer.height}%` : undefined,
        opacity,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={editable ? onPointerDown : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        className={cn(
          'block h-auto w-full max-h-full object-contain',
          !layer.height && 'max-h-[18%] min-h-[24px]'
        )}
      />
      {editable && selected ? (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neon-violet/90 px-1.5 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-white">
          Logo
        </span>
      ) : null}
    </div>
  );
}
