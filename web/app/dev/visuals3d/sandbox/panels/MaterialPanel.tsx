'use client';

import type { SandboxState } from '../useSandboxState';
import { Empty, Label, SectionTip } from '../widgets';

type Props = Pick<SandboxState, 'insp' | 'palette' | 'setPalette' | 'paletteTargets' | 'toggleTarget'>;

export function MaterialPanel({ insp, palette, setPalette, paletteTargets, toggleTarget }: Props) {
  return (
    <div className="space-y-3">
      <Label>Material / Palette</Label>
      <SectionTip>Palette colors tint selected materials on the active model at runtime.</SectionTip>

      <div className="flex gap-2">
        {palette.map((c, i) => (
          <input
            key={i}
            type="color"
            value={c}
            title={`Palette slot ${i + 1}`}
            onChange={(e) => setPalette((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
            className="h-8 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent"
          />
        ))}
      </div>

      {insp ? (
        <div>
          <p className="mb-1 text-[11px] text-zinc-500">Palette-tinted materials</p>
          {insp.materials.map((name) => {
            const idx = paletteTargets.indexOf(name);
            return (
              <label key={name} className="flex items-center gap-2" title={`Tint material "${name}" with palette`}>
                <input
                  type="checkbox"
                  checked={idx !== -1}
                  onChange={() => toggleTarget(name)}
                  className="accent-cyan-400"
                />
                <span className="truncate">{name}</span>
                {idx !== -1 && (
                  <span
                    className="ml-auto h-3 w-3 flex-none rounded-sm"
                    style={{ background: palette[idx % palette.length] }}
                  />
                )}
              </label>
            );
          })}
          <p className="mt-2 text-[10px] text-zinc-600">
            {insp.meshes.length} meshes · {insp.materials.length} materials · {insp.clips.length} clips
          </p>
        </div>
      ) : (
        <Empty>Load a GLB to see materials.</Empty>
      )}
    </div>
  );
}
