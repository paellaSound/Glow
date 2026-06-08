'use client';

import { useMemo, useState } from 'react';
import { AllocationBar } from './allocation-bar';
import { cn } from '@/lib/utils';
import type { DeviceTarget, RoomStatePayload } from '@/lib/glow/types';

type DeviceTargetSliderProps = {
  devices: RoomStatePayload['devices'];
  value: DeviceTarget;
  onChange: (target: DeviceTarget) => void;
};

export function DeviceTargetSlider({ devices, value, onChange }: DeviceTargetSliderProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'fraction' | 'devices'>(
    value.kind === 'matrix_range' ? 'all' : value.kind
  );

  // Re-use AllocationBar weights for the fraction
  const from = value.kind === 'fraction' ? value.from : 0;
  const to = value.kind === 'fraction' ? value.to : 1;

  const mockEffects = useMemo(() => {
    const list: any[] = [];
    if (from > 0) {
      list.push({ id: 'before', presetId: 'Rest' as any, active: true, weight: Math.round(from * 100) });
    }
    list.push({ id: 'target', presetId: 'Targeted' as any, active: true, weight: Math.round((to - from) * 100) });
    if (to < 1) {
      list.push({ id: 'after', presetId: 'Rest' as any, active: true, weight: Math.round((1 - to) * 100) });
    }
    return list;
  }, [from, to]);

  const handleAllocationChange = (updated: any[]) => {
    let newFrom = 0;
    let newTo = 1;
    const beforeItem = updated.find(e => e.id === 'before');
    const targetItem = updated.find(e => e.id === 'target');
    
    if (beforeItem) {
      newFrom = beforeItem.weight / 100;
    }
    if (targetItem) {
      newTo = newFrom + (targetItem.weight / 100);
    }
    
    onChange({
      kind: 'fraction',
      from: Number(Math.max(0, Math.min(1, newFrom)).toFixed(2)),
      to: Number(Math.max(0, Math.min(1, newTo)).toFixed(2))
    });
  };

  // Resolve target devices to get the targeted count
  const targetedDevices = useMemo(() => {
    if (value.kind === 'all') return devices;
    if (value.kind === 'devices') {
      return devices.filter(d => value.publicIds.includes(d.publicId));
    }
    if (value.kind === 'fraction') {
      const sorted = [...devices].sort(
        (a, b) => a.joinedAt - b.joinedAt || a.publicId.localeCompare(b.publicId)
      );
      const start = Math.floor(value.from * sorted.length);
      const end = Math.min(sorted.length, Math.round(value.to * sorted.length));
      return sorted.slice(start, end);
    }
    return [];
  }, [devices, value]);

  const handleTabChange = (type: 'all' | 'fraction' | 'devices') => {
    setActiveTab(type);
    if (type === 'all') {
      onChange({ kind: 'all' });
    } else if (type === 'fraction') {
      onChange({ kind: 'fraction', from: 0, to: 1 });
    } else if (type === 'devices') {
      onChange({ kind: 'devices', publicIds: [] });
    }
  };

  const toggleDevice = (publicId: string) => {
    if (value.kind !== 'devices') return;
    const current = value.publicIds;
    if (current.includes(publicId)) {
      onChange({ kind: 'devices', publicIds: current.filter(id => id !== publicId) });
    } else {
      onChange({ kind: 'devices', publicIds: [...current, publicId] });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-cyber text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Target Audience
          </h4>
          <p className="mt-1 text-xs text-white">
            Selected: <span className="text-neon-cyan font-bold">{targetedDevices.length}</span> / {devices.length} screens
          </p>
        </div>

        <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
          {(['all', 'fraction', 'devices'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[10px] font-cyber uppercase tracking-widest transition-all",
                activeTab === tab
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab === 'all' ? 'All' : tab === 'fraction' ? 'Slice' : 'Chips'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'fraction' && (
        <div className="mt-2 space-y-2">
          <AllocationBar
            effects={mockEffects}
            onChange={handleAllocationChange}
          />
          <p className="text-[9px] text-muted-foreground font-cyber uppercase tracking-wider text-center">
            Drag dividing handles to resize targeted audience slice
          </p>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="mt-2">
          {devices.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-2">No player devices connected</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
              {devices.map(device => {
                const isSelected = value.kind === 'devices' && value.publicIds.includes(device.publicId);
                return (
                  <button
                    key={device.publicId}
                    type="button"
                    onClick={() => toggleDevice(device.publicId)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-cyber uppercase tracking-wider transition-all",
                      isSelected
                        ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", device.status === 'online' ? 'bg-green-400' : 'bg-zinc-600')} />
                    {device.nickname || device.publicId.slice(0, 6)} {device.label ? `[${device.label}]` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
