'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GlowLogo } from '@/components/glow/glow-logo';
import { cn } from '@/lib/utils';

type BorderRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const BORDER_PAD = {
  glow: { x: 10, y: 7 },
  rave: { x: 7, y: 5 },
};

function ovalPath(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  const cy = y + ry;

  return [
    `M ${cx + rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
    'Z',
  ].join(' ');
}

export function GlowBrandLockup({ className }: { className?: string }) {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const raveRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [glowBorder, setGlowBorder] = useState<BorderRect | null>(null);
  const [raveBorder, setRaveBorder] = useState<BorderRect | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const icon = iconRef.current;
    const glow = glowRef.current;
    const rave = raveRef.current;
    if (!container || !icon || !glow || !rave) return;

    const containerRect = container.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const glowRect = glow.getBoundingClientRect();
    const raveRect = rave.getBoundingClientRect();
    const glowGroupTop = Math.min(iconRect.top, glowRect.top);
    const glowGroupRight = Math.max(iconRect.right, glowRect.right);
    const glowGroupBottom = Math.max(iconRect.bottom, glowRect.bottom);
    const glowGroupLeft = Math.min(iconRect.left, glowRect.left);

    setSize({
      width: containerRect.width,
      height: containerRect.height,
    });

    setGlowBorder({
      x: glowGroupLeft - containerRect.left - BORDER_PAD.glow.x,
      y: glowGroupTop - containerRect.top - BORDER_PAD.glow.y,
      width: glowGroupRight - glowGroupLeft + BORDER_PAD.glow.x * 2,
      height: glowGroupBottom - glowGroupTop + BORDER_PAD.glow.y * 2,
    });

    setRaveBorder({
      x: raveRect.left - containerRect.left - BORDER_PAD.rave.x,
      y: raveRect.top - containerRect.top - BORDER_PAD.rave.y,
      width: raveRect.width + BORDER_PAD.rave.x * 2,
      height: raveRect.height + BORDER_PAD.rave.y * 2,
    });
  }, []);

  useEffect(() => {
    measure();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (iconRef.current) observer.observe(iconRef.current);
    if (glowRef.current) observer.observe(glowRef.current);
    if (raveRef.current) observer.observe(raveRef.current);

    window.addEventListener('resize', measure);

    if (document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const showBorders = size.width > 0 && glowBorder && raveBorder;

  return (
    <Link
      ref={containerRef}
      href="/"
      className={cn('glow-brand-lockup group relative inline-flex items-center gap-2.5', className)}
    >
      {showBorders && (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.width}
          height={size.height}
          aria-hidden
        >
          <path
            d={ovalPath(
              glowBorder.x,
              glowBorder.y,
              glowBorder.width,
              glowBorder.height,
            )}
            pathLength={100}
            className="glow-snake-border glow-snake-border--cyan"
          />
          <path
            d={ovalPath(
              glowBorder.x,
              glowBorder.y,
              glowBorder.width,
              glowBorder.height,
            )}
            pathLength={100}
            className="glow-snake-head glow-snake-head--cyan"
          />
          <path
            d={ovalPath(
              raveBorder.x,
              raveBorder.y,
              raveBorder.width,
              raveBorder.height,
            )}
            pathLength={100}
            className="glow-snake-border glow-snake-border--magenta"
          />
          <path
            d={ovalPath(
              raveBorder.x,
              raveBorder.y,
              raveBorder.width,
              raveBorder.height,
            )}
            pathLength={100}
            className="glow-snake-head glow-snake-head--magenta"
          />
        </svg>
      )}

      <span
        ref={iconRef}
        className="glow-brand-lockup__icon relative z-10 flex shrink-0 items-center justify-center"
      >
        <GlowLogo className="glow-brand-lockup__logo h-[19px] w-5" />
      </span>

      <span
        ref={glowRef}
        className="glow-brand-lockup__text glow-brand-lockup__text--glow relative z-10 text-xl font-display font-extrabold uppercase tracking-widest text-neon-cyan neon-text-cyan neon-flicker"
      >
        GLOW
      </span>

      <span
        ref={raveRef}
        className="glow-brand-lockup__text glow-brand-lockup__text--rave relative z-10 text-[10px] font-cyber tracking-widest text-neon-magenta uppercase ml-1 opacity-90"
      >
        THE RAVE
      </span>
    </Link>
  );
}
