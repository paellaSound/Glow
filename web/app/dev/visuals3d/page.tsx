'use client';

/**
 * Dev harness for the 3D visuals scene — mounts ThreeDSurface without a room
 * or socket server. Synthetic audio keeps the scene alive; the controls drive
 * the same controller API the orchestrator events would.
 *
 * Not linked from anywhere; visit /dev/visuals3d directly.
 */

import { useRef, useState } from 'react';
import { ThreeDSurface, type ThreeDAction } from '@/components/visuals/three-d-surface';
import type { Visuals3DInput } from 'glow-visuals-3d';

const PALETTE = ['#00e3ff', '#ff00c8', '#ffb300', '#7c4dff'];

export default function Visuals3DDevPage() {
  const inputRef = useRef<Visuals3DInput>({
    timeMs: 0,
    palette: PALETTE,
    audio: undefined, // scene falls back to synthetic oscillation
  });
  const [energy, setEnergy] = useState(0);
  const [action, setAction] = useState<ThreeDAction>(null);

  return (
    <div className="fixed inset-0 bg-black">
      <ThreeDSurface inputRef={inputRef} energy={energy} pendingAction={action} />
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900/80 px-4 py-2 font-mono text-xs text-zinc-300">
        <span>energy {energy}</span>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
        />
        <button
          className="rounded bg-zinc-700 px-2 py-1 hover:bg-zinc-600"
          onClick={() => setAction({ action: 'shockwave', nonce: Date.now() })}
        >
          shockwave
        </button>
        <button
          className="rounded bg-zinc-700 px-2 py-1 hover:bg-zinc-600"
          onClick={() => setAction({ action: 'burst', nonce: Date.now() })}
        >
          burst
        </button>
      </div>
    </div>
  );
}
