'use client';

import type { SandboxState } from './useSandboxState';
import { Empty, Label, SectionTip, Slider } from './widgets';

type Props = Pick<
  SandboxState,
  | 'editingLevel'
  | 'lvl'
  | 'insp'
  | 'toggleClipInPool'
  | 'updateLevel'
  | 'controllerRef'
>;

export function Timeline({
  editingLevel,
  lvl,
  insp,
  toggleClipInPool,
  updateLevel,
  controllerRef,
}: Props) {
  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 p-3 font-mono text-xs">
      <div className="mb-2 flex items-center justify-between">
        <Label>Timeline / Loop · level {editingLevel}</Label>
        <div className="flex gap-2">
          <button
            onClick={() => controllerRef.current?.lockCurrentClip()}
            title="Lock/unlock current pool clip (stops auto-rotation)"
            className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 hover:bg-zinc-700"
          >
            🔒 lock
          </button>
          <button
            onClick={() => controllerRef.current?.skipClip()}
            title="Skip to next pool clip immediately"
            className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 hover:bg-zinc-700"
          >
            ⏭ skip
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">pool</span>
          <div className="flex gap-1">
            {(['random', 'sequential'] as const).map((m) => (
              <button
                key={m}
                onClick={() =>
                  updateLevel({ poolPlayback: { ...lvl.poolPlayback, mode: m } })
                }
                title={m === 'random' ? 'Pick next clip at random' : 'Advance in list order'}
                className={`rounded px-2 py-0.5 ${
                  lvl.poolPlayback.mode === m
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <Slider
            label={`min hold ${(lvl.poolPlayback.minHoldMs / 1000).toFixed(1)}s`}
            min={1}
            max={30}
            step={0.5}
            value={lvl.poolPlayback.minHoldMs / 1000}
            onChange={(v) =>
              updateLevel({ poolPlayback: { ...lvl.poolPlayback, minHoldMs: v * 1000 } })
            }
            tip="Floor time before auto-advance; actual jump waits for clip loop end"
          />
        </div>
        <SectionTip>
          Auto-advance waits for the clip loop end — never cuts mid-animation.
        </SectionTip>
      </div>

      {!insp && <Empty>Load a GLB to see clips for this level.</Empty>}
      {insp && insp.clips.length === 0 && <Empty>no clips in this GLB</Empty>}

      {insp && insp.clips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insp.clips.map((c) => {
            const inPool = lvl.clipPool.includes(c);
            return (
              <div
                key={c}
                className={`flex items-center gap-2 rounded border px-2 py-1 ${
                  inPool ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-900/50'
                }`}
                title={inPool ? 'In idle pool' : 'Not in pool'}
              >
                <input
                  type="checkbox"
                  checked={inPool}
                  onChange={() => toggleClipInPool(c)}
                  title="Include in idle clip pool"
                  className="accent-cyan-400"
                />
                <span className="max-w-[120px] truncate">{c}</span>
                <button
                  onClick={() => controllerRef.current?.playAction(editingLevel, c)}
                  title="Test one-shot"
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-cyan-300 hover:bg-zinc-700"
                >
                  ▶
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
