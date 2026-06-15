'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { BillingSection } from '@/lib/plans/billing-cards';
import { cn } from '@/lib/utils';

type PlanDetailsPopoverProps = {
  planName: string;
  sections: BillingSection[];
};

/** Small "i" trigger that reveals the full feature detail without cluttering the card. */
export function PlanDetailsPopover({ planName, sections }: PlanDetailsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`What's included in ${planName}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex size-6 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-colors',
          'hover:border-neon-cyan/40 hover:text-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan',
          open && 'border-neon-cyan/40 text-neon-cyan'
        )}
      >
        <Info className="size-3.5" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`${planName} details`}
          className="absolute right-0 top-8 z-30 w-64 rounded-xl border border-neon-cyan/20 bg-zinc-950/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm"
        >
          <p className="mb-3 text-[10px] font-cyber uppercase tracking-widest text-neon-cyan">
            {planName} — full detail
          </p>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.key}>
                <p className="mb-1 text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item} className="text-[11px] leading-snug text-zinc-300">
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
