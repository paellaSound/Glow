'use client';

import { Button } from '@/components/ui/button';
import { getPreset, type AudioSource, type PresetId, type PresetParams } from 'glow-presets';

type PresetPickerProps = {
  availablePresetIds: string[];
  onRun: (presetId: PresetId, params?: PresetParams) => void;
  disabled?: boolean;
  audioReactive?: boolean;
  audioSource?: AudioSource;
  onAudioSourceChange?: (source: AudioSource) => void;
  showAudioSource?: boolean;
  activePresetId?: string | null;
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
}: PresetPickerProps) {
  const visiblePresets = availablePresetIds.filter((id) => {
    if (id === 'audio') {
      return audioReactive;
    }
    return true;
  });

  function handleRun(presetId: PresetId) {
    if (presetId === 'audio') {
      onRun(presetId, { audioSource });
      return;
    }
    onRun(presetId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {visiblePresets.map((presetId) => {
          const preset = getPreset(presetId);
          const label = preset?.label ?? presetId;
          const isActive = activePresetId === presetId;

          return (
            <Button
              key={presetId}
              variant={isActive ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => handleRun(presetId as PresetId)}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {showAudioSource && audioReactive && availablePresetIds.includes('audio') ? (
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
