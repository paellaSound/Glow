'use client';

import { useState } from 'react';
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LayoutOption = { id: string; name: string };

type LayoutManagerProps = {
  layouts: LayoutOption[];
  activeLayoutId: string;
  dirty: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
  onSave: () => void;
  onSaveAsNew: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

const actionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-neon-violet/40 bg-neon-violet/10 px-3 text-[10px] font-cyber uppercase tracking-widest text-neon-violet transition-colors hover:bg-neon-violet/20 disabled:opacity-40 disabled:hover:bg-neon-violet/10';

export function LayoutManager({
  layouts,
  activeLayoutId,
  dirty,
  saving,
  onSelect,
  onSave,
  onSaveAsNew,
  onRename,
  onDelete,
}: LayoutManagerProps) {
  const [prompt, setPrompt] = useState<{ mode: 'new' | 'rename'; value: string } | null>(null);
  const activeName = layouts.find((layout) => layout.id === activeLayoutId)?.name ?? '';

  function openPrompt(mode: 'new' | 'rename') {
    setPrompt({ mode, value: mode === 'rename' ? activeName : '' });
  }

  function confirmPrompt() {
    if (!prompt) return;
    const value = prompt.value.trim();
    if (!value) return;
    if (prompt.mode === 'new') onSaveAsNew(value);
    else onRename(value);
    setPrompt(null);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-neon-violet/30 bg-neon-violet/[0.06] p-3">
      <span className="text-[10px] font-cyber uppercase tracking-widest text-neon-violet/80">Layout</span>

      {prompt ? (
        <>
          <input
            autoFocus
            value={prompt.value}
            onChange={(event) => setPrompt({ ...prompt, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirmPrompt();
              if (event.key === 'Escape') setPrompt(null);
            }}
            placeholder={prompt.mode === 'new' ? 'New layout name' : 'Rename layout'}
            className="h-8 min-w-[12rem] flex-1 rounded-full border border-white/15 bg-black/40 px-3 text-xs text-foreground"
          />
          <button type="button" onClick={confirmPrompt} disabled={saving} className={actionClass}>
            <Check className="size-3.5" />
            {prompt.mode === 'new' ? 'Create' : 'Rename'}
          </button>
          <button
            type="button"
            onClick={() => setPrompt(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[10px] font-cyber uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        </>
      ) : (
        <>
          <select
            value={activeLayoutId}
            onChange={(event) => onSelect(event.target.value)}
            disabled={saving}
            aria-label="Active layout"
            className="h-8 min-w-[10rem] rounded-full border border-white/15 bg-black/40 px-3 text-xs font-cyber uppercase tracking-wider text-foreground"
          >
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.name}
              </option>
            ))}
          </select>

          {dirty ? (
            <span className="text-[9px] font-cyber uppercase tracking-widest text-amber-400">
              Unsaved
            </span>
          ) : null}

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className={cn(actionClass, 'bg-neon-violet/20')}
          >
            <Save className="size-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => openPrompt('new')} disabled={saving} className={actionClass}>
            <Plus className="size-3.5" />
            Save as new
          </button>
          <button type="button" onClick={() => openPrompt('rename')} disabled={saving} className={actionClass}>
            <Pencil className="size-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={saving || layouts.length <= 1}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-cyber uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </>
      )}
    </div>
  );
}
