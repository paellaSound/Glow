'use client';

import { MAX_ENERGY } from 'glow-visuals-3d';
import type { SandboxState } from './useSandboxState';
import { AudioBands } from './widgets';

type Props = Pick<
  SandboxState,
  | 'canvasRef'
  | 'controllerRef'
  | 'dragging'
  | 'anyGlb'
  | 'editingLevel'
  | 'loading'
  | 'error'
  | 'micActive'
  | 'lvl'
>;

export function Viewport({
  canvasRef,
  controllerRef,
  dragging,
  anyGlb,
  editingLevel,
  loading,
  error,
  micActive,
  lvl,
}: Props) {
  const playingClip = lvl.clipPool[0] ?? null;

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: 'block' }} />

      {(dragging || !anyGlb) && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-colors ${
            dragging ? 'bg-cyan-500/10' : ''
          }`}
        >
          <div
            className={`rounded-2xl border-2 border-dashed px-10 py-8 text-center font-mono text-sm ${
              dragging ? 'border-cyan-400 text-cyan-200' : 'border-zinc-700 text-zinc-500'
            }`}
          >
            <p className="mb-1 text-base">Drop a .glb onto level {editingLevel}</p>
            <p className="text-xs text-zinc-600">+ .hdr for environment · or use test GLB in Properties</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute left-4 top-4 rounded-full bg-zinc-900/80 px-3 py-1 font-mono text-xs text-cyan-300">
          loading…
        </div>
      )}
      {error && (
        <div className="absolute left-4 top-4 max-w-md rounded-lg bg-red-900/80 px-3 py-2 font-mono text-xs text-red-200">
          {error}
        </div>
      )}

      {anyGlb && (
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-2 font-mono text-xs">
          <div className="rounded-full bg-zinc-900/80 px-3 py-1 text-zinc-300">
            energy {editingLevel} / {MAX_ENERGY}
            {micActive && <span className="ml-2 text-cyan-300">🎤 live</span>}
            {playingClip && <span className="ml-2 text-violet-300">▶ {playingClip}</span>}
          </div>
          <div className="w-48 rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-2">
            <AudioBands controllerRef={controllerRef} />
          </div>
        </div>
      )}
    </div>
  );
}
