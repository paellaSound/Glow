'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PresetPicker } from '@/components/glow/preset-picker';
import { getPreset, presetsForPlan } from '@/lib/glow/presets';
import type { PlanEntitlements, PresetId, PresetParams } from '@/lib/glow/types';
import { useVisualEngine } from '@/lib/glow/visual-engine';

const FREE_PRESETS = presetsForPlan('free');

export default function StandalonePage() {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const visual = useVisualEngine({ row: 0, col: 0, matrixRows: 1, matrixCols: 1 });

  useEffect(() => {
    async function loadEntitlements() {
      const response = await fetch('/api/user');
      if (!response.ok) return;

      const data = (await response.json()) as { entitlements?: PlanEntitlements | null };
      setEntitlements(data.entitlements ?? null);
    }

    void loadEntitlements();
  }, []);

  const availablePresets = entitlements?.availablePresets ?? FREE_PRESETS;

  function runPreset(presetId: PresetId, params?: PresetParams) {
    setActivePreset(presetId);
    visual.schedulePreset({
      presetId,
      seedTimestamp: Date.now(),
      targetTimestamp: Date.now(),
      matrix: { rows: 1, cols: 1 },
      params: presetId === 'audio' ? { audioSource: 'local', ...params } : params,
    });
  }

  const activeLabel = activePreset ? (getPreset(activePreset)?.label ?? activePreset) : null;

  return (
    <div className="relative min-h-[100dvh]" style={{ backgroundColor: visual.color }}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Link href="/">
          <Button size="sm">Home</Button>
        </Link>
        <span className="rounded bg-black/40 px-3 py-1 text-xs text-white">
          Standalone {activeLabel ? `· ${activeLabel}` : ''}
          {visual.micActive ? ' · Mic on' : ''}
          {visual.micError ? ` · ${visual.micError}` : ''}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <PresetPicker
          availablePresetIds={availablePresets}
          audioReactive={entitlements?.audioReactive ?? false}
          activePresetId={activePreset}
          onRun={runPreset}
        />
      </div>
    </div>
  );
}
