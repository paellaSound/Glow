'use client';

import { ENERGY_LEVEL_COUNT } from 'glow-visuals-3d';
import type { OutlinerSelection } from './constants';
import type { SandboxState } from './useSandboxState';
import { Label } from './widgets';

type Props = Pick<
  SandboxState,
  'levels' | 'editingLevel' | 'selection' | 'selectLevel' | 'setSelection' | 'setWorkspace' | 'actions'
>;

export function Outliner({
  levels,
  editingLevel,
  selection,
  selectLevel,
  setSelection,
  setWorkspace,
  actions,
}: Props) {
  return (
    <div className="shrink-0 border-b border-zinc-800 p-3 font-mono text-xs">
      <Label>Outliner</Label>
      <ul className="mt-2 space-y-0.5">
        {Array.from({ length: ENERGY_LEVEL_COUNT }, (_, i) => {
          const lv = levels[i]!;
          const active = selection.kind === 'level' && selection.level === i;
          return (
            <li key={i}>
              <button
                onClick={() => {
                  selectLevel(i);
                  setWorkspace('levels');
                }}
                title={lv.glb ? `Level ${i}: ${lv.glb}` : `Level ${i}: no GLB`}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${
                  active ? 'bg-cyan-500/20 text-cyan-200' : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <span className={lv.glb ? 'text-cyan-400' : 'text-zinc-600'}>{lv.glb ? '●' : '○'}</span>
                <span>Level {i}</span>
                {i === editingLevel && <span className="ml-auto text-[10px] text-zinc-500">preview</span>}
              </button>
            </li>
          );
        })}
        <li>
          <button
            onClick={() => {
              setSelection({ kind: 'actions' });
              setWorkspace('actions');
            }}
            title="Global named actions"
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${
              selection.kind === 'actions' ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <span>⚡</span>
            <span>Actions ({actions.length})</span>
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              setSelection({ kind: 'scene' });
              setWorkspace('export');
            }}
            title="Global scene settings"
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${
              selection.kind === 'scene' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <span>🖼</span>
            <span>Scene (global)</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
