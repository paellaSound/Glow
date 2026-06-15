'use client';

import type { EnergyMode } from 'glow-visuals-3d';
import type { SandboxState } from '../useSandboxState';
import { AvgEnergyMeter, Empty, Label, Row, SectionTip, Slider } from '../widgets';

type Props = Pick<
  SandboxState,
  | 'editingLevel'
  | 'lvl'
  | 'useTestGlb'
  | 'updateLevel'
  | 'energyMode'
  | 'setEnergyMode'
  | 'autoDwellMs'
  | 'setAutoDwellMs'
  | 'autoSilenceFloor'
  | 'setAutoSilenceFloor'
  | 'controllerRef'
> & { hslToHex: (h: import('glow-visuals-3d').HSL) => string; hexToHsl: (hex: string) => import('glow-visuals-3d').HSL };

export function LevelPanel({
  editingLevel,
  lvl,
  useTestGlb,
  updateLevel,
  energyMode,
  setEnergyMode,
  autoDwellMs,
  setAutoDwellMs,
  autoSilenceFloor,
  setAutoSilenceFloor,
  controllerRef,
  hslToHex,
  hexToHsl,
}: Props) {
  return (
    <div className="space-y-3">
      <Label>Level {editingLevel}</Label>
      <SectionTip>Each energy level (0–5) can have its own GLB, background color, light, and clip pool.</SectionTip>

      <div className="space-y-2">
        <Row k="GLB" v={lvl.glb ?? '—'} />
        <button
          onClick={() => void useTestGlb()}
          title="Load the built-in test model (goku.glb)"
          className="w-full rounded border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
        >
          use test GLB (goku)
        </button>
        <p className="text-[10px] text-zinc-600">…or drag a .glb onto the viewport</p>
      </div>

      <div className="flex items-center gap-2" title="Background color + global ambient tint (HSL 0–1)">
        <span className="w-20 text-zinc-500">Background HSL</span>
        <input
          type="color"
          value={hslToHex(lvl.hsl)}
          onChange={(e) => updateLevel({ hsl: hexToHsl(e.target.value) })}
          className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
        <div className="flex items-center gap-2">
          <span className="w-12 text-zinc-500">drive</span>
          <div className="flex flex-1 gap-1">
            {(['manual', 'auto'] as EnergyMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setEnergyMode(m)}
                title={m === 'manual' ? 'You set the preview level' : "Song average energy picks the level"}
                className={`flex-1 rounded py-1 ${
                  energyMode === m ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {energyMode === 'auto' && (
          <>
            <AvgEnergyMeter controllerRef={controllerRef} />
            <Slider
              label={`dwell ${(autoDwellMs / 1000).toFixed(1)}s`}
              min={0.5}
              max={15}
              step={0.5}
              value={autoDwellMs / 1000}
              onChange={(v) => setAutoDwellMs(v * 1000)}
              tip="Minimum time on a level before auto can switch"
            />
            <Slider
              label={`silence gate ${autoSilenceFloor.toFixed(2)}`}
              min={0}
              max={0.3}
              step={0.01}
              value={autoSilenceFloor}
              onChange={setAutoSilenceFloor}
              tip="Energy below this won't change the auto level"
            />
          </>
        )}
      </div>

      {!lvl.glb && <Empty>Drop a .glb here or use the test button.</Empty>}
    </div>
  );
}
