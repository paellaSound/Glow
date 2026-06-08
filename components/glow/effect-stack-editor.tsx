'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PresetPicker } from '@/components/glow/preset-picker';
import {
  getPreset,
  type AudioSource,
  type EffectBlendMode,
  type EffectLayer,
  type PresetId,
  type PresetParams,
} from 'glow-presets';
import { cn } from '@/lib/utils';

const BLEND_MODES: EffectBlendMode[] = ['normal', 'add', 'screen', 'multiply'];

type StackLayerDraft = {
  id: string;
  presetId: PresetId;
  params?: PresetParams;
  blend: EffectBlendMode;
  opacity: number;
  muted: boolean;
  solo: boolean;
};

type EffectStackEditorProps = {
  availablePresetIds: string[];
  palette: string[];
  onRunStack: (layers: EffectLayer[]) => void;
  disabled?: boolean;
  audioReactive?: boolean;
  audioSource?: AudioSource;
  onAudioSourceChange?: (source: AudioSource) => void;
  showAudioSource?: boolean;
};

function createLayer(presetId: PresetId, params?: PresetParams): StackLayerDraft {
  return {
    id: crypto.randomUUID(),
    presetId,
    params,
    blend: 'normal',
    opacity: 1,
    muted: false,
    solo: false,
  };
}

export function EffectStackEditor({
  availablePresetIds,
  palette,
  onRunStack,
  disabled = false,
  audioReactive = false,
  audioSource = 'local',
  onAudioSourceChange,
  showAudioSource = false,
}: EffectStackEditorProps) {
  const [layers, setLayers] = useState<StackLayerDraft[]>([]);
  const [showAddPicker, setShowAddPicker] = useState(false);

  function updateLayer(id: string, patch: Partial<StackLayerDraft>) {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function removeLayer(id: string) {
    setLayers((current) => current.filter((layer) => layer.id !== id));
  }

  function moveLayer(id: string, direction: -1 | 1) {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      if (index < 0) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function addLayer(presetId: PresetId, params?: PresetParams) {
    const mergedParams: PresetParams = {
      ...params,
      palette,
      ...(presetId === 'audio' ? { audioSource } : {}),
    };
    setLayers((current) => [...current, createLayer(presetId, mergedParams)]);
    setShowAddPicker(false);
  }

  function resolveLayersForRun(): EffectLayer[] {
    const hasSolo = layers.some((layer) => layer.solo);
    return layers
      .filter((layer) => !layer.muted)
      .filter((layer) => !hasSolo || layer.solo)
      .map(({ presetId, params, blend, opacity }) => ({
        presetId,
        params: {
          ...params,
          palette,
          ...(presetId === 'audio' ? { audioSource: params?.audioSource ?? audioSource } : {}),
        },
        blend,
        opacity,
      }));
  }

  function handleRunStack() {
    const resolved = resolveLayersForRun();
    if (resolved.length === 0) return;
    onRunStack(resolved);
  }

  return (
    <div className="flex flex-col gap-4">
      {layers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {layers.map((layer, index) => {
            const label = getPreset(layer.presetId)?.label ?? layer.presetId;
            return (
              <div
                key={layer.id}
                className={cn(
                  'rounded-lg border border-white/10 bg-black/20 p-3',
                  layer.muted && 'opacity-50'
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-cyber uppercase tracking-wider text-violet-300">
                    Layer {index + 1}: {label}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={layer.solo ? 'default' : 'outline'}
                      disabled={disabled}
                      className="h-7 px-2 text-[10px] uppercase"
                      onClick={() =>
                        updateLayer(layer.id, {
                          solo: !layer.solo,
                          muted: layer.solo ? layer.muted : false,
                        })
                      }
                    >
                      Solo
                    </Button>
                    <Button
                      size="sm"
                      variant={layer.muted ? 'default' : 'outline'}
                      disabled={disabled || layer.solo}
                      className="h-7 px-2 text-[10px] uppercase"
                      onClick={() => updateLayer(layer.id, { muted: !layer.muted })}
                    >
                      Mute
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled || index === 0}
                      className="h-7 px-2 text-[10px]"
                      onClick={() => moveLayer(layer.id, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled || index === layers.length - 1}
                      className="h-7 px-2 text-[10px]"
                      onClick={() => moveLayer(layer.id, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      className="h-7 px-2 text-[10px] uppercase text-red-300"
                      onClick={() => removeLayer(layer.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                    Blend
                    <select
                      value={layer.blend}
                      disabled={disabled}
                      className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white"
                      onChange={(event) =>
                        updateLayer(layer.id, { blend: event.target.value as EffectBlendMode })
                      }
                    >
                      {BLEND_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                    Opacity ({Math.round(layer.opacity * 100)}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.opacity * 100)}
                      disabled={disabled}
                      className="w-full accent-violet-400"
                      onChange={(event) =>
                        updateLayer(layer.id, { opacity: Number(event.target.value) / 100 })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Add presets below to build a layered stack. Bottom layer renders first.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setShowAddPicker((current) => !current)}
        >
          {showAddPicker ? 'Hide preset list' : 'Add layer'}
        </Button>
        <Button
          disabled={disabled || layers.length === 0}
          onClick={handleRunStack}
        >
          Run stack
        </Button>
      </div>

      {showAddPicker ? (
        <PresetPicker
          availablePresetIds={availablePresetIds}
          audioReactive={audioReactive}
          audioSource={audioSource}
          onAudioSourceChange={onAudioSourceChange}
          showAudioSource={showAudioSource}
          disabled={disabled}
          showLockedPresets={false}
          onRun={addLayer}
        />
      ) : null}
    </div>
  );
}
