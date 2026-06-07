'use client';

import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { NeonButton } from '@/components/ui/neon';
import { cn } from '@/lib/utils';

export type RigCue = {
  id: string;
  visualArtId: string;
  sortOrder: number;
  params?: Record<string, unknown>;
  transition?: { type: 'cut' | 'fade'; durationMs: number };
  label?: string;
};

interface CueListProps {
  cues: RigCue[];
  cueIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onJump: (index: number) => void;
  disabled?: boolean;
}

const ART_LABELS: Record<string, string> = {
  'glow-branded': 'Glow Branded',
  'pulse-grid': 'Pulse Grid',
  'audio-shader': 'Audio Shader',
};

function artLabel(id: string): string {
  return ART_LABELS[id] ?? id;
}

function transitionLabel(cue: RigCue): string {
  if (!cue.transition) return 'CUT';
  const type = cue.transition.type.toUpperCase();
  return `${type} ${cue.transition.durationMs}ms`;
}

export function CueList({ cues, cueIndex, onNext, onPrev, onJump, disabled = false }: CueListProps) {
  if (cues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
        <p className="text-xs font-cyber text-muted-foreground tracking-wide uppercase">
          No cues in this rig
        </p>
        <p className="text-[10px] text-zinc-600 mt-1">
          Add arts to the rig's cue list in the Rigs Manager.
        </p>
      </div>
    );
  }

  const currentCue = cues[cueIndex];
  const nextIndex = (cueIndex + 1) % cues.length;
  const nextCue = cues[nextIndex];

  return (
    <div className="space-y-4">
      {/* Current / Next preview */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-3">
          <p className="text-[9px] font-cyber text-neon-cyan uppercase tracking-widest mb-1">
            NOW
          </p>
          <p className="text-sm font-cyber text-white truncate">
            {currentCue?.label || artLabel(currentCue?.visualArtId ?? '')}
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
            #{cueIndex + 1} · {transitionLabel(currentCue)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/3 p-3">
          <p className="text-[9px] font-cyber text-zinc-400 uppercase tracking-widest mb-1">
            NEXT
          </p>
          <p className="text-sm font-cyber text-zinc-300 truncate">
            {nextCue?.label || artLabel(nextCue?.visualArtId ?? '')}
          </p>
          <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">
            #{nextIndex + 1} · {transitionLabel(nextCue)}
          </p>
        </div>
      </div>

      {/* Next/Go button */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled || cues.length <= 1}
          className="flex-none w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-zinc-400 hover:border-white/40 hover:text-white disabled:opacity-30 transition-all"
          aria-label="Previous cue"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <NeonButton
          color="cyan"
          variant="solid"
          onClick={onNext}
          disabled={disabled}
          className="flex-1 gap-2 text-xs uppercase tracking-widest h-10"
          id="cue-next-go"
        >
          <Zap className="w-3.5 h-3.5" />
          Next / Go
        </NeonButton>

        <button
          type="button"
          onClick={() => onNext()}
          disabled={disabled || cues.length <= 1}
          className="flex-none w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-zinc-400 hover:border-white/40 hover:text-white disabled:opacity-30 transition-all"
          aria-label="Next cue"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Full cue list */}
      <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 pr-1">
        {cues.map((cue, index) => (
          <button
            key={cue.id}
            type="button"
            onClick={() => onJump(index)}
            disabled={disabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150',
              index === cueIndex
                ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-white'
                : 'border border-transparent hover:border-white/10 hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span
              className={cn(
                'flex-none w-5 h-5 rounded-full border text-[9px] font-cyber flex items-center justify-center',
                index === cueIndex
                  ? 'border-neon-cyan/60 text-neon-cyan bg-neon-cyan/15'
                  : 'border-white/15 text-zinc-500'
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-cyber truncate">
                {cue.label || artLabel(cue.visualArtId)}
              </p>
              <p className="text-[9px] font-mono text-zinc-600 truncate">
                {cue.visualArtId} · {transitionLabel(cue)}
              </p>
            </div>
            {index === cueIndex && (
              <span className="flex-none text-[8px] font-cyber text-neon-cyan uppercase tracking-widest">
                LIVE
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-[10px] font-cyber text-muted-foreground tracking-wider uppercase text-center">
        Cue {cueIndex + 1} of {cues.length} · wraps around
      </p>
    </div>
  );
}
