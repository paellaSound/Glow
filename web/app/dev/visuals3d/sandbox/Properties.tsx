'use client';

import { useState } from 'react';
import type { LevelTab } from './constants';
import { ActionsPanel } from './ActionsPanel';
import { AudioPanel } from './panels/AudioPanel';
import { CameraPanel } from './panels/CameraPanel';
import { ExportPanel } from './panels/ExportPanel';
import { LevelPanel } from './panels/LevelPanel';
import { LightPanel } from './panels/LightPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { RenderPanel } from './panels/RenderPanel';
import type { SandboxState } from './useSandboxState';
import { hexToHsl, hslToHex } from './utils';
import { Label } from './widgets';

type Props = { state: SandboxState };

const LEVEL_TABS: { id: LevelTab; icon: string; label: string }[] = [
  { id: 'level', icon: '🎚', label: 'Level' },
  { id: 'camera', icon: '🎥', label: 'Camera' },
  { id: 'light', icon: '💡', label: 'Light' },
  { id: 'material', icon: '🎨', label: 'Material' },
];

export function Properties({ state }: Props) {
  const [levelTab, setLevelTab] = useState<LevelTab>('level');
  const { workspace, selection } = state;

  const colorUtils = { hslToHex, hexToHsl };

  let content: React.ReactNode;

  if (selection.kind === 'actions' || workspace === 'actions') {
    content = <ActionsPanel {...state} {...colorUtils} />;
  } else if (workspace === 'audio') {
    content = <AudioPanel {...state} />;
  } else if (workspace === 'export') {
    content = (
      <div className="space-y-4">
        <ExportPanel {...state} />
        <RenderPanel {...state} />
      </div>
    );
  } else if (selection.kind === 'scene') {
    content = <RenderPanel {...state} />;
  } else if (workspace === 'layout') {
    content = (
      <div className="space-y-4">
        <CameraPanel {...state} />
        <RenderPanel {...state} />
      </div>
    );
  } else {
    content = (
      <div className="space-y-3">
        <div className="flex gap-1">
          {LEVEL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setLevelTab(t.id)}
              title={t.label}
              className={`flex-1 rounded py-1 text-[11px] ${
                levelTab === t.id ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
        {levelTab === 'level' && <LevelPanel {...state} {...colorUtils} />}
        {levelTab === 'camera' && <CameraPanel {...state} />}
        {levelTab === 'light' && <LightPanel {...state} {...colorUtils} />}
        {levelTab === 'material' && <MaterialPanel {...state} />}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs">
      <Label>Properties</Label>
      <div className="mt-2">{content}</div>
    </div>
  );
}
