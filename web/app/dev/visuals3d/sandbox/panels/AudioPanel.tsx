'use client';

import type { AudioSource, AudioTarget } from 'glow-visuals-3d';
import { AUDIO_SOURCES, AUDIO_TARGETS } from '../constants';
import type { SandboxState } from '../useSandboxState';
import {
  AudioBands,
  BindingMeter,
  Empty,
  Label,
  SectionTip,
  Slider,
  TriggerFlash,
} from '../widgets';

type Props = Pick<
  SandboxState,
  | 'controllerRef'
  | 'bindings'
  | 'updateBinding'
  | 'addBinding'
  | 'removeBinding'
  | 'triggers'
  | 'actions'
  | 'updateTrigger'
  | 'addTrigger'
  | 'removeTrigger'
>;

export function AudioPanel({
  controllerRef,
  bindings,
  updateBinding,
  addBinding,
  removeBinding,
  triggers,
  actions,
  updateTrigger,
  addTrigger,
  removeTrigger,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Audio reactivity</Label>
          <button onClick={addBinding} title="Add audio→visual binding" className="text-cyan-300 hover:text-cyan-200">
            + add
          </button>
        </div>
        <SectionTip>Continuous modulation: source band → target parameter. Amount = gain, filter = smoothing.</SectionTip>
        <AudioBands controllerRef={controllerRef} />
        {bindings.length === 0 && <Empty>no connections</Empty>}
        {bindings.map((b, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={b.enabled}
                onChange={(e) => updateBinding(i, { enabled: e.target.checked })}
                title="Enable binding"
                className="accent-cyan-400"
              />
              <select
                value={b.source}
                onChange={(e) => updateBinding(i, { source: e.target.value as AudioSource })}
                title="Audio source band"
                className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
              >
                {AUDIO_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-zinc-600">→</span>
              <select
                value={b.target}
                onChange={(e) => updateBinding(i, { target: e.target.value as AudioTarget })}
                title="Visual target"
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
              >
                {AUDIO_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeBinding(i)}
                className="px-1 text-zinc-500 hover:text-red-400"
                title="Remove binding"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Slider
                label={`amount ${b.amount.toFixed(2)}`}
                min={0}
                max={3}
                step={0.05}
                value={b.amount}
                onChange={(v) => updateBinding(i, { amount: v })}
                tip="Gain multiplier"
              />
              <Slider
                label={`filter ${b.smoothing.toFixed(2)}`}
                min={0}
                max={0.95}
                step={0.05}
                value={b.smoothing}
                onChange={(v) => updateBinding(i, { smoothing: v })}
                tip="Smoothing (higher = less jitter)"
              />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[9px] text-zinc-600">out</span>
              <BindingMeter controllerRef={controllerRef} index={i} amount={b.amount} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between">
          <Label>Action triggers</Label>
          <button onClick={addTrigger} title="Add threshold trigger" className="text-cyan-300 hover:text-cyan-200">
            + add
          </button>
        </div>
        <SectionTip>Discrete events: when a band crosses threshold, fire the selected action (rising edge + cooldown).</SectionTip>
        {triggers.length === 0 && <Empty>no triggers</Empty>}
        {triggers.map((tr, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={tr.enabled}
                onChange={(e) => updateTrigger(i, { enabled: e.target.checked })}
                title="Enable trigger"
                className="accent-cyan-400"
              />
              <select
                value={tr.source}
                onChange={(e) => updateTrigger(i, { source: e.target.value as AudioSource })}
                title="Source band"
                className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
              >
                {AUDIO_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-zinc-600">→</span>
              <select
                value={tr.actionId}
                onChange={(e) => updateTrigger(i, { actionId: e.target.value })}
                title="Action to fire"
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
              >
                <option value="">— action —</option>
                {actions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <TriggerFlash controllerRef={controllerRef} index={i} />
              <button
                onClick={() => removeTrigger(i)}
                className="px-1 text-zinc-500 hover:text-red-400"
                title="Remove trigger"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Slider
                label={`threshold ${tr.threshold.toFixed(2)}`}
                min={0}
                max={1}
                step={0.05}
                value={tr.threshold}
                onChange={(v) => updateTrigger(i, { threshold: v })}
                tip="Band level to cross (0–1)"
              />
              <Slider
                label={`cooldown ${(tr.cooldownMs / 1000).toFixed(1)}s`}
                min={0}
                max={5}
                step={0.1}
                value={tr.cooldownMs / 1000}
                onChange={(v) => updateTrigger(i, { cooldownMs: v * 1000 })}
                tip="Minimum time between fires"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
