'use client';

/**
 * Designer sandbox for 3D visuals — /dev/visuals3d.
 * Blender-style layout: workspaces · viewport · outliner/properties · timeline.
 */

import { Outliner } from './sandbox/Outliner';
import { Properties } from './sandbox/Properties';
import { Timeline } from './sandbox/Timeline';
import { useSandboxState } from './sandbox/useSandboxState';
import { Viewport } from './sandbox/Viewport';
import { Workspaces } from './sandbox/Workspaces';

export default function Visuals3DSandboxPage() {
  const state = useSandboxState();

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-black text-zinc-200"
      onDragOver={state.onDragOver}
      onDragLeave={state.onDragLeave}
      onDrop={state.onDrop}
    >
      <Workspaces workspace={state.workspace} onChange={state.setWorkspace} />

      <div className="flex min-h-0 flex-1">
        <Viewport
          canvasRef={state.canvasRef}
          controllerRef={state.controllerRef}
          dragging={state.dragging}
          anyGlb={state.anyGlb}
          editingLevel={state.editingLevel}
          loading={state.loading}
          error={state.error}
          micActive={state.micActive}
          lvl={state.lvl}
        />

        <aside className="flex w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
          <Outliner
            levels={state.levels}
            editingLevel={state.editingLevel}
            selection={state.selection}
            selectLevel={state.selectLevel}
            setSelection={state.setSelection}
            setWorkspace={state.setWorkspace}
            actions={state.actions}
          />
          <Properties state={state} />
        </aside>
      </div>

      <Timeline
        editingLevel={state.editingLevel}
        lvl={state.lvl}
        insp={state.insp}
        toggleClipInPool={state.toggleClipInPool}
        updateLevel={state.updateLevel}
        controllerRef={state.controllerRef}
      />
    </div>
  );
}
