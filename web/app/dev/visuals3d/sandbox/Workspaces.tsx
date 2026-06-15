'use client';

import Link from 'next/link';
import { WORKSPACES, type Workspace } from './constants';

export function Workspaces({
  workspace,
  onChange,
}: {
  workspace: Workspace;
  onChange: (w: Workspace) => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 font-mono text-xs">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-widest text-cyan-300">3D SANDBOX</h1>
        <nav className="flex gap-1">
          {WORKSPACES.map((w) => (
            <button
              key={w.id}
              onClick={() => onChange(w.id)}
              title={`Workspace: ${w.label}`}
              className={`rounded px-2.5 py-1 ${
                workspace === w.id
                  ? 'bg-cyan-500 font-bold text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {w.label}
            </button>
          ))}
        </nav>
      </div>
      <Link
        href="/dev/visuals3d/play"
        className="rounded bg-zinc-800 px-2 py-1 text-cyan-300 hover:bg-zinc-700"
        title="Open live player"
      >
        player →
      </Link>
    </header>
  );
}
