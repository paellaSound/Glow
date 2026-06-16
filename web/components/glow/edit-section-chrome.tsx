'use client';

import { ArrowDown, ArrowUp, EyeOff } from 'lucide-react';
import type { ConsoleMode } from '@/lib/glow/console-mode';

/**
 * Wraps a desk section. In operate mode it is a transparent passthrough (still a
 * div so CSS `order` applies); in edit mode it adds a top bar with move up/down +
 * hide controls. Shared by the Play Devices desk and the Visuals desk.
 */
export function EditSectionChrome({
  mode,
  order,
  onHide,
  onMoveUp,
  onMoveDown,
  children,
}: {
  mode: ConsoleMode;
  order?: number;
  onHide: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
}) {
  if (mode !== 'edit') return <div style={{ order }}>{children}</div>;

  return (
    <div style={{ order }} className="overflow-hidden rounded-2xl border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label="Move section up"
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label="Move section down"
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="inline-flex items-center gap-1.5 text-[10px] font-cyber uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <EyeOff className="size-3.5" />
          Hide
        </button>
      </div>
      {children}
    </div>
  );
}
