'use client';

import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ShareIconTriggerProps = React.ComponentProps<'button'> & {
  label?: string;
  copied?: boolean;
  copiedLabel?: string;
  /** When true, drops outer chrome so the trigger sits inside a tab segment. */
  embedded?: boolean;
  segmentActive?: boolean;
};

/** Icon-only share trigger; label expands on hover via width transition. */
export function ShareIconTrigger({
  label = 'Share',
  copied = false,
  copiedLabel = 'Copied!',
  embedded = false,
  segmentActive = false,
  disabled,
  className,
  ...props
}: ShareIconTriggerProps) {
  const text = copied ? copiedLabel : label;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={text}
      className={cn(
        'group/share flex h-7 max-w-7 items-center overflow-hidden rounded-md transition-[max-width,border-color,background-color,color] duration-200 ease-out',
        embedded
          ? cn(
              'border-0 bg-transparent',
              segmentActive
                ? 'text-neon-cyan hover:bg-white/10 hover:text-neon-cyan'
                : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
            )
          : cn(
              'border border-white/10 bg-white/5 text-zinc-400',
              'hover:max-w-[6.5rem] hover:border-white/20 hover:bg-white/10 hover:text-zinc-200'
            ),
        'hover:max-w-[6.5rem]',
        'disabled:pointer-events-none disabled:opacity-40',
        copied && 'max-w-[6.5rem] text-neon-cyan',
        !embedded && copied && 'border-neon-cyan/30',
        className
      )}
      {...props}
    >
      <span className="flex size-7 shrink-0 items-center justify-center">
        <Share2 className="size-3.5" />
      </span>
      <span
        className={cn(
          'pr-2 text-[10px] font-cyber uppercase tracking-widest whitespace-nowrap',
          'opacity-0 transition-opacity duration-200 group-hover/share:opacity-100',
          copied && 'opacity-100'
        )}
      >
        {text}
      </span>
    </button>
  );
}
