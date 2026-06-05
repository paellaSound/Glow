'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PRESET_LABELS } from '@/lib/glow/presets';
import { useVisualEngine } from '@/lib/glow/visual-engine';

export default function StandalonePage() {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const visual = useVisualEngine({ row: 0, col: 0, matrixRows: 1, matrixCols: 1 });

  function runPreset(presetId: string) {
    setActivePreset(presetId);
    visual.schedulePreset({
      presetId,
      seedTimestamp: Date.now(),
      targetTimestamp: Date.now(),
      matrix: { rows: 1, cols: 1 },
    });
  }

  return (
    <div className="relative min-h-[100dvh]" style={{ backgroundColor: visual.color }}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Link href="/">
          <Button variant="outline" size="sm">
            Home
          </Button>
        </Link>
        <span className="rounded bg-black/40 px-3 py-1 text-xs text-white">
          Standalone {activePreset ? `· ${PRESET_LABELS[activePreset] ?? activePreset}` : ''}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 p-4">
        {['solid', 'flash', 'pulse', 'wave', 'rainbow'].map((presetId) => (
          <Button key={presetId} variant="secondary" onClick={() => runPreset(presetId)}>
            {PRESET_LABELS[presetId] ?? presetId}
          </Button>
        ))}
      </div>
    </div>
  );
}
