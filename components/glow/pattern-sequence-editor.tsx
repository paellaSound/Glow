'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Eye, Layers, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AllocationBar } from '@/components/glow/allocation-bar';
import { ColorPaletteField } from '@/components/glow/color-palette-field';
import { PatternSequencePreview } from '@/components/glow/pattern-sequence-preview';
import { PresetPicker } from '@/components/glow/preset-picker';
import {
  createDefaultDraft,
  fetchPatternSequences,
  createEmptyEffect,
  getActiveEffects,
  normalizeWeights,
  toDistributionEffects,
  type PatternSequenceDraft,
  type PatternSequenceEffect,
  type PatternSequenceRecord,
} from '@/lib/glow/pattern-sequences';
import { getPreset, type AudioSource, type PresetId } from 'glow-presets';
import { cn } from '@/lib/utils';

type PatternSequenceEditorVariant = 'default' | 'control';

type PatternSequenceEditorProps = {
  availablePresetIds: string[];
  audioReactive: boolean;
  effectLayering: boolean;
  maxPatternSequences: number;
  disabled?: boolean;
  audioSource: AudioSource;
  onAudioSourceChange: (source: AudioSource) => void;
  initialDraft?: PatternSequenceDraft;
  onPreviewChange?: (draft: PatternSequenceDraft) => void;
  onSendLive: (draft: PatternSequenceDraft) => void;
  variant?: PatternSequenceEditorVariant;
  roomCode?: string;
  liveName?: string | null;
  fallbackEnabled?: boolean;
  fallbackSeed?: number;
  presetSeed?: number;
};

export function PatternSequenceEditor({
  availablePresetIds,
  audioReactive,
  effectLayering,
  maxPatternSequences,
  disabled = false,
  audioSource,
  onAudioSourceChange,
  initialDraft,
  onPreviewChange,
  onSendLive,
  variant = 'default',
  roomCode = 'PREVIEW',
  liveName = null,
  fallbackEnabled = false,
  fallbackSeed = 0,
  presetSeed,
}: PatternSequenceEditorProps) {
  const { data: savedSequences = [], mutate } = useSWR<PatternSequenceRecord[]>(
    '/api/pattern-sequences',
    fetchPatternSequences
  );

  const [draft, setDraft] = useState<PatternSequenceDraft>(
    initialDraft ?? createDefaultDraft()
  );
  const [previewEffectId, setPreviewEffectId] = useState<string | null>(() => {
    const effects = initialDraft?.effects ?? createDefaultDraft().effects;
    return effects.length === 1 ? effects[0]!.id : null;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const hasAutoSelectedRef = useRef(false);

  const activeEffects = useMemo(() => getActiveEffects(draft.effects), [draft.effects]);
  const previewEffect = useMemo(
    () => draft.effects.find((effect) => effect.id === previewEffectId) ?? null,
    [draft.effects, previewEffectId]
  );
  const isSplitPreview = activeEffects.length > 1 && previewEffectId === null;

  useEffect(() => {
    if (draft.effects.length === 1) {
      setPreviewEffectId(draft.effects[0]!.id);
      return;
    }

    if (previewEffectId && !draft.effects.some((effect) => effect.id === previewEffectId)) {
      setPreviewEffectId(activeEffects[0]?.id ?? null);
    }
  }, [draft.effects, activeEffects, previewEffectId]);

  const isControlVariant = variant === 'control';
  const hasSavedSequences = (savedSequences?.length ?? 0) > 0;
  const selectedSequence = useMemo(
    () => savedSequences?.find((sequence) => sequence.id === selectedId) ?? null,
    [savedSequences, selectedId]
  );
  const trimmedName = draft.name.trim();
  const nameChanged = Boolean(
    selectedSequence && trimmedName !== selectedSequence.name.trim()
  );
  const saveAsNew = !selectedId || nameChanged;
  const atSequenceLimit = (savedSequences?.length ?? 0) >= maxPatternSequences;
  const duplicateName = useMemo(() => {
    if (!trimmedName || !saveAsNew) return false;
    return savedSequences.some(
      (sequence) => sequence.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
  }, [savedSequences, trimmedName, saveAsNew]);

  useEffect(() => {
    if (!isControlVariant || !hasSavedSequences || hasAutoSelectedRef.current) return;

    if (selectedId) {
      hasAutoSelectedRef.current = true;
      return;
    }

    const preferred =
      savedSequences?.find((sequence) => sequence.isDefault) ?? savedSequences?.[0];
    if (!preferred) return;

    loadSequence(preferred, { sendLive: true, quiet: true });
    hasAutoSelectedRef.current = true;
  }, [isControlVariant, hasSavedSequences, savedSequences, selectedId]);

  const isDirty = selectedId
    ? JSON.stringify(savedSequences?.find((seq) => seq.id === selectedId)) !==
      JSON.stringify({ ...draft, id: selectedId, createdAt: '', updatedAt: '', isDefault: draft.isDefault ?? false })
    : true;

  function patchDraft(patch: Partial<PatternSequenceDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onPreviewChange?.(next);
      return next;
    });
  }

  function patchEffects(nextEffects: PatternSequenceEffect[]) {
    patchDraft({ effects: nextEffects });
  }

  function loadSequence(
    sequence: PatternSequenceRecord,
    options?: { sendLive?: boolean; quiet?: boolean }
  ) {
    const loaded: PatternSequenceDraft = {
      name: sequence.name,
      palette: sequence.palette,
      effects: sequence.effects as PatternSequenceEffect[],
      isDefault: sequence.isDefault,
    };
    setSelectedId(sequence.id);
    setDraft(loaded);
    setPreviewEffectId(loaded.effects.length === 1 ? loaded.effects[0]!.id : null);
    onPreviewChange?.(loaded);
    if (options?.sendLive) {
      onSendLive(loaded);
    }
    if (!options?.quiet) {
      setStatus(`Loaded "${sequence.name}"`);
    }
  }

  function addEffect(presetId: PresetId, params?: { audioSource?: AudioSource }) {
    const nextEffects = [...draft.effects];
    const newEffect = createEmptyEffect(presetId);
    if (presetId === 'audio') {
      newEffect.params = { audioSource: params?.audioSource ?? audioSource };
    }

    if (!effectLayering) {
      patchDraft({
        effects: [{ ...newEffect, active: true, weight: 100 }],
      });
    } else {
      nextEffects.forEach((effect) => {
        effect.active = false;
        effect.weight = 0;
      });
      nextEffects.push({ ...newEffect, active: true });
      patchEffects(normalizeWeights(nextEffects));
      setPreviewEffectId(newEffect.id);
    }
    setShowAddPicker(false);
  }

  function toggleEffectActive(effectId: string) {
    if (!effectLayering) return;

    const next = draft.effects.map((effect) =>
      effect.id === effectId ? { ...effect, active: !effect.active } : effect
    );
    patchEffects(normalizeWeights(next));
  }

  function removeEffect(effectId: string) {
    const next = draft.effects.filter((effect) => effect.id !== effectId);
    if (next.length === 0) {
      patchDraft({ effects: [createEmptyEffect('pulse')] });
      return;
    }
    patchEffects(normalizeWeights(next));
  }

  async function saveSequence() {
    if (saveAsNew && duplicateName) {
      setStatus('A sequence with this name already exists');
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const payload = {
        name: trimmedName || 'Untitled Sequence',
        palette: draft.palette,
        effects: draft.effects,
        isDefault: saveAsNew ? false : (draft.isDefault ?? false),
      };

      const response = await fetch(
        saveAsNew ? '/api/pattern-sequences' : `/api/pattern-sequences/${selectedId}`,
        {
          method: saveAsNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? 'Could not save sequence');
        return;
      }

      await mutate();
      setSelectedId(data.id);
      patchDraft({ name: data.name, isDefault: data.isDefault ?? false });
      setStatus(saveAsNew ? `Added "${data.name}"` : `Saved "${data.name}"`);

      if (isControlVariant) {
        onSendLive({
          name: data.name,
          palette: payload.palette,
          effects: payload.effects,
          isDefault: payload.isDefault,
        });
      }
    } catch {
      setStatus('Could not save sequence');
    } finally {
      setSaving(false);
    }
  }

  function handleSequenceSelect(id: string) {
    if (!id) return;
    const sequence = savedSequences?.find((item) => item.id === id);
    if (!sequence) return;

    loadSequence(sequence, { sendLive: isControlVariant });
  }

  function handleSendLive() {
    onSendLive(draft);
    setStatus(`Live: ${draft.name}`);
  }

  const effectsHelpText = isControlVariant ? (
    <>
      <span className="text-neon-cyan">In mix</span> = sent to screens when this sequence is
      selected. <span className="text-neon-violet">Preview</span> = shown in the canvas above.
    </>
  ) : (
    <>
      <span className="text-neon-cyan">In mix</span> = included when you Send live.{' '}
      <span className="text-neon-violet">Preview</span> = shown in the canvas above before you
      launch.
    </>
  );

  const canOverwrite = !saveAsNew && Boolean(selectedId) && isDirty && Boolean(trimmedName);
  const canAddNew =
    saveAsNew &&
    Boolean(trimmedName) &&
    !duplicateName &&
    (isDirty || nameChanged || !hasSavedSequences);
  const canSave = canOverwrite || canAddNew;

  const saveButtonLabel = !hasSavedSequences
    ? 'Save first sequence'
    : saveAsNew
      ? 'Add new sequence'
      : 'Overwrite current pattern';

  const namePlaceholder = !hasSavedSequences && isControlVariant
    ? 'Save your first sequence'
    : 'Sequence name';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
        {isControlVariant ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                Pattern sequence
              </label>
              <select
                value={selectedId ?? ''}
                disabled={disabled || !hasSavedSequences}
                onChange={(event) => handleSequenceSelect(event.target.value)}
                className="h-9 min-w-[12rem] flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground"
              >
                {!hasSavedSequences ? (
                  <option value="">No saved sequences yet</option>
                ) : (
                  savedSequences?.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.name}
                      {sequence.isDefault ? ' (default)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                value={draft.name}
                disabled={disabled}
                onChange={(event) => patchDraft({ name: event.target.value })}
                placeholder={namePlaceholder}
                aria-invalid={duplicateName}
                className={cn(
                  'min-w-[12rem] flex-1',
                  duplicateName && 'border-red-400/50 focus-visible:ring-red-400/30'
                )}
              />
              <Button
                type="button"
                size="sm"
                disabled={
                  disabled || saving || !canSave || (saveAsNew && atSequenceLimit)
                }
                onClick={() => void saveSequence()}
              >
                <Save data-icon="inline-start" />
                {saveButtonLabel}
              </Button>
            </div>

            {!hasSavedSequences ? (
              <p className="text-xs text-muted-foreground">
                Name and save your first sequence to load it in any room.
              </p>
            ) : duplicateName ? (
              <p className="text-xs text-red-400">
                A sequence with this name already exists. Choose a different name to add a new one.
              </p>
            ) : nameChanged ? (
              <p className="text-xs text-muted-foreground">
                Name changed — will create a new sequence. Keep the original name to overwrite.
              </p>
            ) : isDirty && selectedId ? (
              <p className="text-xs text-muted-foreground">
                Unsaved changes — Overwrite current pattern to save them.
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              To rename or delete sequences, go to the{' '}
              <Link href="/pattern-sequences" className="text-neon-violet underline">
                sequence library
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                Saved sequence
              </label>
              <select
                value={selectedId ?? ''}
                disabled={disabled}
                onChange={(event) => {
                  const id = event.target.value;
                  if (!id) {
                    setSelectedId(null);
                    const fresh = createDefaultDraft(draft.palette);
                    setDraft(fresh);
                    onPreviewChange?.(fresh);
                    return;
                  }
                  const sequence = savedSequences?.find((item) => item.id === id);
                  if (sequence) loadSequence(sequence);
                }}
                className="h-9 min-w-[12rem] flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground"
              >
                <option value="">New draft</option>
                {savedSequences?.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>
                    {sequence.name}
                    {sequence.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                value={draft.name}
                disabled={disabled}
                onChange={(event) => patchDraft({ name: event.target.value })}
                placeholder="Sequence name"
                className="min-w-[12rem] flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={disabled || saving || !trimmedName || (saveAsNew && atSequenceLimit)}
                onClick={() => void saveSequence()}
              >
                <Save data-icon="inline-start" />
                {saveButtonLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={disabled || activeEffects.length === 0}
                onClick={handleSendLive}
              >
                Send live
              </Button>
            </div>
            {nameChanged ? (
              <p className="text-xs text-muted-foreground">
                Name changed — will create a new sequence. Keep the original name to overwrite.
              </p>
            ) : null}
          </>
        )}

        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        {!effectLayering ? (
          <p className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
            Multi-effect audience split is available on Plus 50.{' '}
            <Link href="/billing" className="underline">
              Upgrade plan
            </Link>
          </p>
        ) : null}
      </div>

      <PatternSequencePreview
        draft={draft}
        previewEffectId={previewEffectId}
        liveName={liveName}
        roomCode={roomCode}
        presetSeed={presetSeed}
        fallbackEnabled={fallbackEnabled}
        fallbackSeed={fallbackSeed}
      />

      <ColorPaletteField
        palette={draft.palette}
        onChange={(palette) => patchDraft({ palette })}
        maxColors={12}
        disabled={disabled}
        label="Pattern Color Palette"
        showGradientPreview
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
              Effects
            </p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">{effectsHelpText}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setShowAddPicker((value) => !value)}
          >
            {showAddPicker ? 'Hide presets' : 'Add effect'}
          </Button>
        </div>

        {activeEffects.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPreviewEffectId(null)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-cyber uppercase tracking-wider transition-colors',
                isSplitPreview
                  ? 'border-neon-violet/40 bg-neon-violet/10 text-neon-violet'
                  : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
              )}
            >
              <Layers className="size-3" />
              Preview split
            </button>
            {previewEffect ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                Canvas: {getPreset(previewEffect.presetId)?.label ?? previewEffect.presetId}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {draft.effects.map((effect) => {
            const label = getPreset(effect.presetId)?.label ?? effect.presetId;
            const isInMix = effect.active;
            const isPreviewing = previewEffectId === effect.id;

            return (
              <div
                key={effect.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg border bg-black/20 p-3 transition-colors',
                  isPreviewing
                    ? 'border-neon-violet/40 bg-neon-violet/5 ring-1 ring-neon-violet/20'
                    : 'border-white/10',
                  !isInMix && !isPreviewing && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  disabled={disabled || !effectLayering}
                  onClick={() => toggleEffectActive(effect.id)}
                  title={
                    effectLayering
                      ? 'Include this effect in the live audience split'
                      : 'Upgrade to include multiple effects in the live mix'
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-cyber uppercase tracking-wider transition-colors',
                    isInMix
                      ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
                      : 'border-white/10 text-muted-foreground hover:border-neon-cyan/20 hover:text-neon-cyan/80'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      isInMix ? 'bg-neon-cyan' : 'bg-zinc-600'
                    )}
                  />
                  {isInMix ? 'In mix' : 'Out of mix'}
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPreviewEffectId(effect.id)}
                  title="Show this effect in the preview canvas"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-cyber uppercase tracking-wider transition-colors',
                    isPreviewing
                      ? 'border-neon-violet/40 bg-neon-violet/15 text-neon-violet'
                      : 'border-white/10 text-muted-foreground hover:border-neon-violet/30 hover:text-neon-violet/80'
                  )}
                >
                  <Eye className="size-3" />
                  {isPreviewing ? 'Previewing' : 'Preview'}
                </button>

                <span className="text-sm font-medium text-foreground">{label}</span>
                {isInMix ? (
                  <span className="text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
                    {effect.weight}%
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || draft.effects.length <= 1}
                  className="ml-auto h-7 px-2 text-[10px] uppercase"
                  onClick={() => removeEffect(effect.id)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>

        {showAddPicker ? (
          <PresetPicker
            availablePresetIds={availablePresetIds}
            audioReactive={audioReactive}
            audioSource={audioSource}
            onAudioSourceChange={onAudioSourceChange}
            showAudioSource
            showLockedPresets={false}
            disabled={disabled}
            onRun={(presetId, params) => addEffect(presetId, params)}
          />
        ) : null}
      </div>

      {effectLayering && activeEffects.length > 1 ? (
        <AllocationBar
          effects={draft.effects}
          disabled={disabled}
          onChange={(effects) => patchEffects(effects)}
        />
      ) : null}
    </div>
  );
}

export { toDistributionEffects };
