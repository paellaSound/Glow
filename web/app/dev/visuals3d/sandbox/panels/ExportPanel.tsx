'use client';

import Link from 'next/link';
import type { SandboxState } from '../useSandboxState';
import { Empty, Label, SectionTip } from '../widgets';

type Props = Pick<
  SandboxState,
  | 'sceneName'
  | 'setSceneName'
  | 'savedMsg'
  | 'anyGlb'
  | 'handleSave'
  | 'handleExportZip'
  | 'zipInputRef'
  | 'handleImportZip'
  | 'scenes'
  | 'handleLoadScene'
  | 'handleDeleteScene'
  | 'levelInspection'
  | 'editingLevel'
>;

export function ExportPanel({
  sceneName,
  setSceneName,
  savedMsg,
  anyGlb,
  handleSave,
  handleExportZip,
  zipInputRef,
  handleImportZip,
  scenes,
  handleLoadScene,
  handleDeleteScene,
  levelInspection,
  editingLevel,
}: Props) {
  const insp = levelInspection[editingLevel];

  return (
    <div className="space-y-3">
      <Label>Export / library</Label>
      <SectionTip>Save to IndexedDB locally, or export a .zip bundle for handoff.</SectionTip>

      <div className="flex gap-2">
        <input
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          placeholder="scene name"
          title="Scene name for save/export"
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
        />
        <button
          onClick={() => void handleSave()}
          disabled={!anyGlb}
          title="Save to local IndexedDB library"
          className="rounded bg-cyan-500 px-3 py-1.5 font-bold text-black hover:bg-cyan-400 disabled:opacity-40"
        >
          {savedMsg ?? 'Save'}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void handleExportZip()}
          disabled={!anyGlb}
          title="Download scene.json + GLBs + HDR as .zip"
          className="flex-1 rounded border border-cyan-500/50 px-3 py-1.5 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40"
        >
          Export .zip
        </button>
        <button
          onClick={() => zipInputRef.current?.click()}
          title="Import a previously exported .zip"
          className="flex-1 rounded border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
        >
          Import .zip
        </button>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportZip(f);
            e.target.value = '';
          }}
        />
      </div>

      {insp && (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[10px] text-zinc-500">
          <p className="mb-1 font-bold text-zinc-400">GLB spec · level {editingLevel}</p>
          <p>{insp.meshes.length} meshes · {insp.materials.length} materials · {insp.clips.length} clips</p>
          {insp.hasCamera && <p>includes baked camera</p>}
        </div>
      )}

      {scenes.length === 0 && <Empty>no saved scenes yet</Empty>}
      {scenes.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-zinc-200">{s.name}</p>
            <p className="text-[10px] text-zinc-600">levels {s.levels.join(',') || '—'}</p>
          </div>
          <button
            onClick={() => void handleLoadScene(s.id)}
            title="Load scene from library"
            className="text-cyan-300 hover:text-cyan-200"
          >
            load
          </button>
          <Link
            href={`/dev/visuals3d/play?scene=${encodeURIComponent(s.id)}`}
            className="text-violet-300 hover:text-violet-200"
            title="Open in player"
          >
            play
          </Link>
          <button
            onClick={() => void handleDeleteScene(s.id)}
            title="Delete from library"
            className="text-zinc-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
