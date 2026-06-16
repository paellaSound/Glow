'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { NeonCard, NeonTitle } from '@/components/ui/neon';
import { cn } from '@/lib/utils';

type CollapsibleDeskCardProps = {
  title: string;
  titleColor?: 'cyan' | 'magenta' | 'violet' | 'foreground';
  subtitle?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glowColor?: 'cyan' | 'magenta' | 'violet' | 'none';
  borderVariant?: 'cyan' | 'magenta' | 'violet' | 'default';
  hoverEffect?: boolean;
  className?: string;
  editModeFlat?: boolean;
  'data-onboarding'?: string;
  children: React.ReactNode;
};

/** Desk section card with standard padding and a collapsible header row. */
export function CollapsibleDeskCard({
  title,
  titleColor = 'foreground',
  subtitle,
  open,
  onOpenChange,
  glowColor = 'none',
  borderVariant = 'default',
  hoverEffect = false,
  className,
  editModeFlat = false,
  'data-onboarding': dataOnboarding,
  children,
}: CollapsibleDeskCardProps) {
  return (
    <NeonCard
      glowColor={glowColor}
      borderVariant={borderVariant}
      hoverEffect={hoverEffect}
      data-onboarding={dataOnboarding}
      className={cn('p-5 sm:p-6', editModeFlat && 'rounded-none border-0', className)}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <NeonTitle as="h2" color={titleColor} className="text-lg font-black tracking-widest">
            {title}
          </NeonTitle>
          {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-zinc-400" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-zinc-400" aria-hidden />
        )}
      </button>

      {open ? <div className="mt-4 border-t border-white/10 pt-4">{children}</div> : null}
    </NeonCard>
  );
}
