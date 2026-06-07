'use client';

import { Button } from '@/components/ui/button';
import {
  getPreset,
  listPresets,
  type AudioSource,
  type PresetId,
  type PresetParams,
} from 'glow-presets';
import { cn } from '@/lib/utils';

type PresetPickerProps = {
  availablePresetIds: string[];
  onRun: (presetId: PresetId, params?: PresetParams) => void;
  disabled?: boolean;
  audioReactive?: boolean;
  audioSource?: AudioSource;
  onAudioSourceChange?: (source: AudioSource) => void;
  showAudioSource?: boolean;
  activePresetId?: string | null;
  showLockedPresets?: boolean;
};

export function PresetPicker({
  availablePresetIds,
  onRun,
  disabled = false,
  audioReactive = false,
  audioSource = 'local',
  onAudioSourceChange,
  showAudioSource = false,
  activePresetId,
  showLockedPresets = true,
}: PresetPickerProps) {
  const availableSet = new Set(availablePresetIds);

  const presets = showLockedPresets
    ? listPresets()
    : listPresets().filter((preset) => {
        if (preset.id === 'audio') {
          return audioReactive && availableSet.has(preset.id);
        }
        return availableSet.has(preset.id);
      });

  function isPresetAvailable(presetId: PresetId): boolean {
    if (presetId === 'audio') {
      return audioReactive && availableSet.has(presetId);
    }
    return availableSet.has(presetId);
  }

  function handleRun(presetId: PresetId) {
    if (!isPresetAvailable(presetId)) return;

    if (presetId === 'audio') {
      onRun(presetId, { audioSource });
      return;
    }
    onRun(presetId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          const isAvailable = isPresetAvailable(preset.id);

          return (
            <Button
              key={preset.id}
              variant={isActive ? 'default' : 'outline'}
              disabled={disabled || !isAvailable}
              title={!isAvailable ? 'Upgrade your plan to unlock this effect' : undefined}
              className={cn(!isAvailable && 'opacity-45')}
              onClick={() => handleRun(preset.id)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {showAudioSource && audioReactive && availableSet.has('audio') ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
          <span>Audio source:</span>
          <Button
            size="sm"
            variant={audioSource === 'local' ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onAudioSourceChange?.('local')}
          >
            Device mic
          </Button>
          <Button
            size="sm"
            variant={audioSource === 'orchestrator' ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onAudioSourceChange?.('orchestrator')}
          >
            Orchestrator mic
          </Button>
        </div>
      ) : null}
    </div>
  );
}
