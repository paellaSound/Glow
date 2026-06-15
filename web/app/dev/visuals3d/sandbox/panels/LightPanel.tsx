'use client';

import type { SandboxState } from '../useSandboxState';
import { Label, SectionTip, Slider } from '../widgets';

type Props = Pick<SandboxState, 'editingLevel' | 'lvl' | 'updateLevel'> & {
  hslToHex: (h: import('glow-visuals-3d').HSL) => string;
  hexToHsl: (hex: string) => import('glow-visuals-3d').HSL;
};

export function LightPanel({ editingLevel, lvl, updateLevel, hslToHex, hexToHsl }: Props) {
  const light = lvl.light;

  const setLight = (patch: Partial<typeof light>) => {
    updateLevel({ light: { ...light, ...patch } });
  };

  return (
    <div className="space-y-3">
      <Label>Key light · level {editingLevel}</Label>
      <SectionTip>Key directional light on the model. Interpolates between levels at runtime.</SectionTip>

      <div className="flex items-center gap-2" title="Light color (HSL)">
        <span className="w-20 text-zinc-500">Color</span>
        <input
          type="color"
          value={hslToHex(light.hsl)}
          onChange={(e) => setLight({ hsl: hexToHsl(e.target.value) })}
          className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
        />
      </div>

      <Slider
        label={`Intensity ${light.intensity.toFixed(2)}`}
        min={0}
        max={5}
        step={0.1}
        value={light.intensity}
        onChange={(v) => setLight({ intensity: v })}
        tip="THREE.DirectionalLight intensity (0–5)"
      />

      <div className="space-y-2">
        <span className="text-zinc-500">Direction (position)</span>
        {(['x', 'y', 'z'] as const).map((axis, idx) => (
          <Slider
            key={axis}
            label={`${axis.toUpperCase()} ${light.direction[idx]!.toFixed(1)}`}
            min={-10}
            max={10}
            step={0.5}
            value={light.direction[idx]!}
            onChange={(v) => {
              const dir = [...light.direction] as [number, number, number];
              dir[idx] = v;
              setLight({ direction: dir });
            }}
            tip={`Light position ${axis} component`}
          />
        ))}
      </div>
    </div>
  );
}
