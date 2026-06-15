'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Eye, Layers, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AllocationBar } from '@/components/glow/allocation-bar';
import { ColorPaletteField } from '@/components/glow/color-palette-field';
import { PatternSequencePreview } from '@/components/glow/pattern-sequence-preview';
import { PresetPicker } from '@/components/glow/preset-picker';
import { GifSearch } from './gif-search';
import { PlanGate, PlanGateBanner } from '@/components/glow/plan-gate';
import type { RoomStatePayload } from '@/lib/glow/types';
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
  type PatternSequenceMedia,
} from '@/lib/glow/pattern-sequences';
import { getPreset, type AudioSource, type PresetId } from 'glow-presets';
import { cn } from '@/lib/utils';

type PatternSequenceEditorVariant = 'default' | 'control';

export type SequenceSelectionOption = { id: string; name: string; isDefault: boolean };
export type SequenceSelectionState = {
  options: SequenceSelectionOption[];
  selectedId: string | null;
};

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
  roomState?: RoomStatePayload;
  mode?: 'edit' | 'operate';
  /** Mirrors the saved-sequence list + current selection upward (e.g. to render the selector in a header). */
  onSelectionStateChange?: (state: SequenceSelectionState) => void;
  /** Apply an external selection. Bump `nonce` to re-trigger even for the same id. */
  externalSelect?: { id: string | null; nonce: number };
  /** Hide the built-in control-variant sequence `<select>` (when it is rendered elsewhere). */
  hideInlineSelector?: boolean;
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
  roomState,
  mode = 'edit',
  onSelectionStateChange,
  externalSelect,
  hideInlineSelector = false,
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
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const hasAutoSelectedRef = useRef(false);
  const appliedSelectNonceRef = useRef<number | null>(null);

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

  const selectionState = useMemo<SequenceSelectionState>(
    () => ({
      options: (savedSequences ?? []).map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        isDefault: sequence.isDefault,
      })),
      selectedId,
    }),
    [savedSequences, selectedId]
  );
  const onSelectionStateChangeRef = useRef(onSelectionStateChange);
  onSelectionStateChangeRef.current = onSelectionStateChange;
  const mirroredSelectionSnapshotRef = useRef('');

  // Mirror the saved-sequence list + current selection upward so the selector
  // can be rendered elsewhere (e.g. the control header).
  useEffect(() => {
    if (!isControlVariant) return;

    const callback = onSelectionStateChangeRef.current;
    if (!callback) return;

    const snapshot = JSON.stringify(selectionState);
    if (snapshot === mirroredSelectionSnapshotRef.current) return;

    mirroredSelectionSnapshotRef.current = snapshot;
    callback(selectionState);
  }, [isControlVariant, selectionState]);

  // Apply a selection requested from outside (header selector). The nonce guard
  // lets the same id be re-applied without looping on internal selection updates.
  useEffect(() => {
    if (!externalSelect) return;
    if (appliedSelectNonceRef.current === externalSelect.nonce) return;
    appliedSelectNonceRef.current = externalSelect.nonce;
    if (externalSelect.id) handleSequenceSelect(externalSelect.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelect]);

  const isDirty = selectedId
    ? JSON.stringify(savedSequences?.find((seq) => seq.id === selectedId)) !==
      JSON.stringify({ ...draft, id: selectedId, createdAt: '', updatedAt: '', isDefault: draft.isDefault ?? false })
    : true;

  const debouncedSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to handle debounced and immediate live updates to prevent event floods
  const sendLiveUpdate = (nextDraft: PatternSequenceDraft, immediate: boolean) => {
    if (!isControlVariant) return;

    if (debouncedSendTimeoutRef.current) {
      clearTimeout(debouncedSendTimeoutRef.current);
      debouncedSendTimeoutRef.current = null;
    }

    if (immediate) {
      onSendLive(nextDraft);
    } else {
      debouncedSendTimeoutRef.current = setTimeout(() => {
        onSendLive(nextDraft);
        debouncedSendTimeoutRef.current = null;
      }, 200);
    }
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (debouncedSendTimeoutRef.current) {
        clearTimeout(debouncedSendTimeoutRef.current);
      }
    };
  }, []);

  function patchDraft(patch: Partial<PatternSequenceDraft>) {
    let next!: PatternSequenceDraft;
    setDraft((current) => {
      next = { ...current, ...patch };
      return next;
    });
    onPreviewChange?.(next);
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
      media: sequence.media,
      isDefault: sequence.isDefault,
    };
    setSelectedId(sequence.id);
    setDraft(loaded);
    setPreviewEffectId(loaded.effects.length === 1 ? loaded.effects[0]!.id : null);
    onPreviewChange?.(loaded);
    if (debouncedSendTimeoutRef.current) {
      clearTimeout(debouncedSendTimeoutRef.current);
      debouncedSendTimeoutRef.current = null;
    }
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

    let nextDraftEffects: PatternSequenceEffect[];
    if (!effectLayering) {
      nextDraftEffects = [{ ...newEffect, active: true, weight: 100 }];
      patchDraft({
        effects: nextDraftEffects,
      });
    } else {
      nextEffects.forEach((effect) => {
        effect.active = false;
        effect.weight = 0;
      });
      nextEffects.push({ ...newEffect, active: true });
      nextDraftEffects = normalizeWeights(nextEffects);
      patchEffects(nextDraftEffects);
      setPreviewEffectId(newEffect.id);
    }
    sendLiveUpdate({ ...draft, effects: nextDraftEffects }, true);
    setShowAddPicker(false);
  }

  function toggleEffectActive(effectId: string) {
    if (!effectLayering) return;

    const next = draft.effects.map((effect) =>
      effect.id === effectId ? { ...effect, active: !effect.active } : effect
    );
    const normalized = normalizeWeights(next);
    patchEffects(normalized);
    sendLiveUpdate({ ...draft, effects: normalized }, true);
  }

  function removeEffect(effectId: string) {
    const next = draft.effects.filter((effect) => effect.id !== effectId);
    if (next.length === 0) {
      const fallbackEffects = [createEmptyEffect('pulse')];
      patchDraft({ effects: fallbackEffects });
      sendLiveUpdate({ ...draft, effects: fallbackEffects }, true);
      return;
    }
    const normalized = normalizeWeights(next);
    patchEffects(normalized);
    sendLiveUpdate({ ...draft, effects: normalized }, true);
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
        media: draft.media,
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
        if (debouncedSendTimeoutRef.current) {
          clearTimeout(debouncedSendTimeoutRef.current);
          debouncedSendTimeoutRef.current = null;
        }
        onSendLive({
          name: data.name,
          palette: payload.palette,
          effects: payload.effects,
          media: payload.media,
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
    if (debouncedSendTimeoutRef.current) {
      clearTimeout(debouncedSendTimeoutRef.current);
      debouncedSendTimeoutRef.current = null;
    }
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

  const showTopPanel =
    !isControlVariant ||
    !hideInlineSelector ||
    mode !== 'operate' ||
    Boolean(status) ||
    !effectLayering;

  return (
    <div className="flex flex-col gap-6">
      {showTopPanel ? (
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
        {isControlVariant ? (
          <>
            {!hideInlineSelector ? (
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
            ) : null}

            {mode !== 'operate' && (
              <>
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
            )}
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
          <PlanGateBanner feature="effect_layering" roomEntitlements={roomState?.entitlements} />
        ) : null}
      </div>
      ) : null}

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
        onChange={(palette) => {
          const next = { ...draft, palette };
          patchDraft({ palette });
          sendLiveUpdate(next, false);
        }}
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
                  'grid grid-cols-[140px_1fr] rounded-lg border overflow-hidden transition-all duration-300',
                  isInMix
                    ? 'border-neon-cyan/60 bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse'
                    : 'border-white/10 opacity-75',
                  isPreviewing && 'ring-1 ring-neon-violet/30'
                )}
              >
                {/* Column 1: IN MIX / OUT OF MIX button */}
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
                    'h-full w-full flex flex-col items-center justify-center gap-1.5 border-r border-white/10 px-3 py-4 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer select-none',
                    isInMix
                      ? 'bg-neon-cyan/20 text-neon-cyan border-r-neon-cyan/30 shadow-[inset_0_0_8px_rgba(0,229,255,0.1)]'
                      : 'bg-black/40 text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full transition-transform duration-300',
                      isInMix ? 'bg-neon-cyan scale-110 shadow-[0_0_8px_#00e5ff]' : 'bg-zinc-600'
                    )}
                  />
                  <span>{isInMix ? 'In mix' : 'Out of mix'}</span>
                </button>

                {/* Column 2: REST OF CONTENT */}
                <div className="flex flex-wrap items-center gap-3 p-3 pl-4">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPreviewEffectId(effect.id)}
                    title="Show this effect in the preview canvas"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-cyber uppercase tracking-wider transition-colors cursor-pointer',
                      isPreviewing
                        ? 'border-neon-violet/40 bg-neon-violet/15 text-neon-violet shadow-[0_0_8px_rgba(124,58,237,0.15)]'
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

      {/* Media Overlay Section */}
      <div
        className={cn(
          'grid grid-cols-[140px_1fr] rounded-xl border overflow-hidden transition-all duration-300',
          draft.media?.active
            ? 'border-neon-magenta/60 bg-neon-magenta/5 shadow-[0_0_15px_rgba(255,0,229,0.25)] animate-pulse'
            : 'border-white/10 bg-black/30'
        )}
      >
        {/* Column 1: IN MIX / OUT OF MIX button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const currentMedia = draft.media;
            if (currentMedia) {
              const updatedMedia = { ...currentMedia, active: !currentMedia.active };
              patchDraft({ media: updatedMedia });
              sendLiveUpdate({ ...draft, media: updatedMedia }, true);
            } else {
              const initialMedia: PatternSequenceMedia = {
                kind: 'text',
                text: 'GLOW THE RAVE',
                mode: 'marquee',
                speed: 5,
                colorHex: '#ffffff',
                loop: true,
                fontSize: 48,
                active: true,
                target: { kind: 'all' }
              };
              patchDraft({ media: initialMedia });
              sendLiveUpdate({ ...draft, media: initialMedia }, true);
            }
          }}
          className={cn(
            'h-full w-full flex flex-col items-center justify-center gap-1.5 border-r border-white/10 px-3 py-6 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer select-none',
            draft.media?.active
              ? 'bg-neon-magenta/20 text-neon-magenta border-r-neon-magenta/30 shadow-[inset_0_0_8px_rgba(255,0,229,0.1)]'
              : 'bg-black/40 text-zinc-500 hover:text-zinc-300'
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full transition-transform duration-300',
              draft.media?.active ? 'bg-neon-magenta scale-110 shadow-[0_0_8px_#ff00e5]' : 'bg-zinc-600'
            )}
          />
          <span>{draft.media?.active ? 'In mix' : 'Out of mix'}</span>
        </button>

        {/* Column 2: REST OF CONTENT */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div
            className="flex items-start justify-between gap-3 cursor-pointer select-none"
            onClick={() => setIsMediaExpanded(!isMediaExpanded)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-cyber text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Media Overlay
                </h4>
                {draft.media?.active && (
                  <span className="inline-flex items-center rounded-full bg-neon-magenta/10 px-2 py-0.5 text-[8px] font-cyber uppercase tracking-widest text-neon-magenta animate-pulse">
                    Live
                  </span>
                )}
              </div>
              
              {/* COLLAPSED TEXT IN HORIZONTAL LAYOUT */}
              {!isMediaExpanded && (
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-300 flex-wrap">
                  {draft.media ? (
                    <>
                      <span className="font-semibold text-neon-magenta uppercase tracking-wider text-[10px]">
                        {draft.media.kind === 'text' ? 'TEXT OVERLAY:' : 'GIF OVERLAY:'}
                      </span>
                      {draft.media.kind === 'text' ? (
                        <span className="truncate max-w-[200px] border border-white/5 bg-black/40 px-2 py-0.5 rounded font-cyber text-[10px] uppercase text-white">
                          "{draft.media.text || 'NONE'}"
                        </span>
                      ) : (
                        <span className="truncate max-w-[200px] border border-white/5 bg-black/40 px-2 py-0.5 rounded font-cyber text-[10px] uppercase text-white">
                          {draft.media.gifSlug || 'No GIF selected'}
                        </span>
                      )}
                      {draft.media.kind === 'text' && (
                        <span className="text-[10px] text-zinc-400">
                          ({draft.media.mode}, Speed: {draft.media.speed}, {draft.media.fontSize}px, {draft.media.colorHex})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-500 italic">No media settings defined</span>
                  )}
                </div>
              )}

              {isMediaExpanded && (
                <p className="mt-1 text-xs text-zinc-400">
                  Superimpose animated text or GIFs over the active background sequence.
                </p>
              )}
            </div>
            
            <button
              type="button"
              className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
              aria-label={isMediaExpanded ? "Collapse" : "Expand"}
            >
              {isMediaExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>

          {/* Form details when expanded */}
          {isMediaExpanded && draft.media && (
            <div className="relative space-y-4 pt-3 border-t border-white/5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                  {/* TODO: Implement custom image uploads in the future
                  <button
                    type="button"
                    disabled
                    className="rounded-md px-3 py-1.5 text-[10px] font-cyber uppercase tracking-widest text-zinc-600 cursor-not-allowed"
                  >
                    Image
                  </button>
                  */}
                  {(['text', 'gif'] as const).map((subTab) => (
                    <button
                      key={subTab}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const updatedMedia: PatternSequenceMedia = {
                          ...draft.media!,
                          kind: subTab,
                          ...(subTab === 'text' && !draft.media?.text ? { text: 'GLOW THE RAVE', mode: 'marquee' as const, speed: 5, loop: true, fontSize: 48 } : {}),
                          ...(subTab === 'gif' && !draft.media?.gifUrl ? { gifSlug: '', gifUrl: '', gifWidth: 200, gifHeight: 200 } : {}),
                        } as PatternSequenceMedia;
                        patchDraft({ media: updatedMedia });
                        if (draft.media?.active) {
                          sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                        }
                      }}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-[10px] font-cyber uppercase tracking-widest transition-all cursor-pointer',
                        draft.media?.kind === subTab
                          ? 'bg-neon-magenta/20 text-neon-magenta'
                          : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      {subTab === 'text' ? 'Text' : 'GIF'}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-cyber text-zinc-500 italic uppercase">
                  (Images: TODO)
                </span>
              </div>

              {draft.media.kind === 'text' && (
                <PlanGate feature="sequencedText" roomEntitlements={roomState?.entitlements}>
                <div className="relative space-y-4">
                  
                  {/* EXPANDED FORM: PLOTTED VERTICALLY FOR PLENTY OF SPACE */}
                  <div className="space-y-1.5">
                    <Label htmlFor="media-text" className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400">
                      Overlay text
                    </Label>
                    <Input
                      id="media-text"
                      value={draft.media.text || ''}
                      disabled={disabled}
                      onChange={(e) => {
                        const updatedMedia = { ...draft.media!, text: e.target.value };
                        patchDraft({ media: updatedMedia });
                        if (draft.media?.active) {
                          sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                        }
                      }}
                      placeholder="TYPE OVERLAY TEXT..."
                      className="font-cyber h-8 text-xs uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400">
                      Mode
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['marquee', 'word_by_word', 'spread_grid'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const updatedMedia = {
                              ...draft.media!,
                              mode,
                              speed: mode === 'word_by_word' ? 3 : mode === 'marquee' ? 12 : 4,
                            };
                            patchDraft({ media: updatedMedia });
                            if (draft.media?.active) {
                              sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                            }
                          }}
                          className={cn(
                            'rounded-lg border px-2 py-1.5 text-[9px] font-cyber uppercase tracking-wider text-center transition-all cursor-pointer',
                            draft.media?.mode === mode
                              ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta'
                              : 'border-white/5 bg-black/20 text-zinc-400 hover:border-white/10'
                          )}
                        >
                          {mode === 'marquee' ? 'Marquee' : mode === 'word_by_word' ? 'Word' : 'Grid'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="media-speed" className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400">
                      Speed
                    </Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const currentSpeed = draft.media?.speed || 5;
                          const nextSpeed = Math.max(1, currentSpeed - 1);
                          const updatedMedia = { ...draft.media!, speed: nextSpeed };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                      >
                        -
                      </button>
                      <input
                        id="media-speed"
                        type="range"
                        min="1"
                        max="30"
                        disabled={disabled}
                        value={draft.media.speed || 5}
                        onChange={(e) => {
                          const updatedMedia = { ...draft.media!, speed: parseInt(e.target.value) };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex-1 accent-neon-magenta cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentSpeed = draft.media?.speed || 5;
                          const nextSpeed = Math.min(30, currentSpeed + 1);
                          const updatedMedia = { ...draft.media!, speed: nextSpeed };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                      >
                        +
                      </button>
                      <span className="font-cyber text-xs text-white min-w-[20px]">{draft.media.speed || 5}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="media-fontsize" className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400">
                      Font Size
                    </Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const currentSize = draft.media?.fontSize || 48;
                          const nextSize = Math.max(12, currentSize - 4);
                          const updatedMedia = { ...draft.media!, fontSize: nextSize };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                      >
                        -
                      </button>
                      <input
                        id="media-fontsize"
                        type="range"
                        min="12"
                        max="120"
                        disabled={disabled}
                        value={draft.media.fontSize || 48}
                        onChange={(e) => {
                          const updatedMedia = { ...draft.media!, fontSize: parseInt(e.target.value) };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex-1 accent-neon-magenta cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentSize = draft.media?.fontSize || 48;
                          const nextSize = Math.min(120, currentSize + 4);
                          const updatedMedia = { ...draft.media!, fontSize: nextSize };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="flex items-center justify-center size-8 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-sm select-none"
                      >
                        +
                      </button>
                      <span className="font-cyber text-xs text-white min-w-[30px]">{draft.media.fontSize || 48}px</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="media-color" className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400">
                      Color
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="media-color"
                        value={draft.media.colorHex || '#ffffff'}
                        disabled={disabled}
                        onChange={(e) => {
                          const updatedMedia = { ...draft.media!, colorHex: e.target.value };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        placeholder="#FFFFFF"
                        className="font-cyber h-8 text-xs text-white border-white/10"
                        maxLength={7}
                      />
                      <input
                        type="color"
                        disabled={disabled}
                        value={draft.media.colorHex?.startsWith('#') ? draft.media.colorHex : '#ffffff'}
                        onChange={(e) => {
                          const updatedMedia = { ...draft.media!, colorHex: e.target.value };
                          patchDraft({ media: updatedMedia });
                          if (draft.media?.active) {
                            sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                          }
                        }}
                        className="size-8 p-0 rounded bg-transparent border border-white/10 overflow-hidden cursor-pointer shrink-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      id="media-loop"
                      type="checkbox"
                      disabled={disabled}
                      checked={draft.media.loop !== false}
                      onChange={(e) => {
                        const updatedMedia = { ...draft.media!, loop: e.target.checked };
                        patchDraft({ media: updatedMedia });
                        if (draft.media?.active) {
                          sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                        }
                      }}
                      className="accent-neon-magenta size-4 rounded cursor-pointer"
                    />
                    <Label htmlFor="media-loop" className="font-cyber text-[9px] uppercase tracking-wider text-zinc-400 select-none cursor-pointer">
                      Loop message
                    </Label>
                  </div>
                </div>
                </PlanGate>
              )}

              {draft.media.kind === 'gif' && (
                <PlanGate feature="gifBroadcast" roomEntitlements={roomState?.entitlements}>
                <div className="relative space-y-3 min-h-[150px]">
                  <GifSearch
                    gifSearchMode={roomState?.entitlements.gifSearchMode}
                    onSelect={(gif) => {
                      const updatedMedia = {
                        ...draft.media!,
                        gifSlug: gif.slug,
                        gifUrl: gif.url,
                        gifWidth: gif.width,
                        gifHeight: gif.height,
                      };
                      patchDraft({ media: updatedMedia });
                      if (draft.media?.active) {
                        sendLiveUpdate({ ...draft, media: updatedMedia }, true);
                      }
                    }}
                    selectedSlug={draft.media.gifSlug}
                  />
                </div>
                </PlanGate>
              )}
            </div>
          )}
        </div>
      </div>

      {effectLayering && activeEffects.length > 1 ? (
        <AllocationBar
          effects={draft.effects}
          disabled={disabled}
          onChange={(effects) => {
            const next = { ...draft, effects };
            patchEffects(effects);
            sendLiveUpdate(next, false);
          }}
        />
      ) : null}
    </div>
  );
}

export { toDistributionEffects };
