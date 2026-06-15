'use client';

import type { Action, CameraConfig, Effect, HSL } from 'glow-visuals-3d';
import type { SandboxState } from './useSandboxState';
import { Empty, Label, SectionTip, Slider } from './widgets';

type Props = Pick<
  SandboxState,
  'actions' | 'addAction' | 'updateAction' | 'removeAction' | 'controllerRef' | 'allClips'
> & {
  hslToHex: (h: HSL) => string;
  hexToHsl: (hex: string) => HSL;
};

function updateEffects(action: Action, effects: Effect[]) {
  return { ...action, effects };
}

export function ActionsPanel({
  actions,
  addAction,
  updateAction,
  removeAction,
  controllerRef,
  allClips,
  hslToHex,
  hexToHsl,
}: Props) {
  const addEffect = (actionId: string, effect: Effect) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    updateAction(actionId, updateEffects(action, [...action.effects, effect]));
  };

  const updateEffect = (actionId: string, index: number, effect: Effect) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    const effects = action.effects.map((e, i) => (i === index ? effect : e));
    updateAction(actionId, updateEffects(action, effects));
  };

  const removeEffect = (actionId: string, index: number) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    updateAction(actionId, updateEffects(action, action.effects.filter((_, i) => i !== index)));
  };

  const captureCameraForEffect = (actionId: string, index: number) => {
    const cam = controllerRef.current?.captureCamera();
    if (!cam) return;
    const action = actions.find((a) => a.id === actionId);
    const effect = action?.effects[index];
    if (!effect || effect.kind !== 'camera') return;
    updateEffect(actionId, index, { ...effect, to: cam });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Actions</Label>
        <button onClick={addAction} title="Add named action" className="text-cyan-300 hover:text-cyan-200">
          + add action
        </button>
      </div>
      <SectionTip>
        Named bundles of effects (animation + camera + background + light). Buttons appear in the live player.
      </SectionTip>

      {actions.length === 0 && <Empty>Create an action to map buttons and audio triggers.</Empty>}

      {actions.map((action) => (
        <div key={action.id} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
          <div className="flex items-center gap-2">
            <input
              value={action.name}
              onChange={(e) => updateAction(action.id, { name: e.target.value })}
              title="Action display name"
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            />
            <button
              onClick={() => controllerRef.current?.playActionById(action.id)}
              title="Test action on active level"
              className="rounded bg-violet-500/20 px-2 py-0.5 text-violet-200 hover:bg-violet-500/30"
            >
              ▶
            </button>
            <button
              onClick={() => removeAction(action.id)}
              title="Delete action"
              className="text-zinc-500 hover:text-red-400"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 pl-1">
            {action.effects.map((effect, ei) => (
              <EffectEditor
                key={ei}
                effect={effect}
                allClips={allClips}
                hslToHex={hslToHex}
                hexToHsl={hexToHsl}
                onChange={(e) => updateEffect(action.id, ei, e)}
                onRemove={() => removeEffect(action.id, ei)}
                onCaptureCamera={() => captureCameraForEffect(action.id, ei)}
              />
            ))}

            <div className="flex flex-wrap gap-1">
              <AddEffectButton
                label="+ anim"
                title="Add animation one-shot effect"
                onClick={() => addEffect(action.id, { kind: 'animation', clip: allClips[0] ?? '' })}
              />
              <AddEffectButton
                label="+ cam"
                title="Add camera move effect"
                onClick={() =>
                  addEffect(action.id, {
                    kind: 'camera',
                    to: { position: [3.5, 2, 5], target: [0, 1, 0], fov: 50 },
                    durationMs: 0,
                  })
                }
              />
              <AddEffectButton
                label="+ bg"
                title="Add background color override"
                onClick={() => addEffect(action.id, { kind: 'background', hsl: { h: 0.62, s: 0.5, l: 0.1 } })}
              />
              <AddEffectButton
                label="+ light"
                title="Add key light override"
                onClick={() =>
                  addEffect(action.id, { kind: 'light', hsl: { h: 0, s: 0, l: 1 }, intensity: 3 })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddEffectButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
    >
      {label}
    </button>
  );
}

function EffectEditor({
  effect,
  allClips,
  hslToHex,
  hexToHsl,
  onChange,
  onRemove,
  onCaptureCamera,
}: {
  effect: Effect;
  allClips: string[];
  hslToHex: (h: HSL) => string;
  hexToHsl: (hex: string) => HSL;
  onChange: (e: Effect) => void;
  onRemove: () => void;
  onCaptureCamera: () => void;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase text-zinc-500">{effect.kind}</span>
        <button onClick={onRemove} className="text-zinc-600 hover:text-red-400" title="Remove effect">
          ✕
        </button>
      </div>

      {effect.kind === 'animation' && (
        <select
          value={effect.clip}
          onChange={(e) => onChange({ kind: 'animation', clip: e.target.value })}
          title="One-shot clip on top of idle"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
        >
          <option value="">— clip —</option>
          {allClips.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {effect.kind === 'camera' && (
        <div className="space-y-2">
          <button
            onClick={onCaptureCamera}
            title="Capture current orbit view as destination"
            className="w-full rounded bg-zinc-800 px-2 py-1 text-cyan-300 hover:bg-zinc-700"
          >
            capture view → framing
          </button>
          <Slider
            label={`FOV ${effect.to.fov.toFixed(0)}°`}
            min={10}
            max={120}
            step={1}
            value={effect.to.fov}
            onChange={(v) => onChange({ ...effect, to: { ...effect.to, fov: v } })}
            tip="Destination FOV"
          />
          <Slider
            label={`duration ${effect.durationMs}ms`}
            min={0}
            max={3000}
            step={50}
            value={effect.durationMs}
            onChange={(v) => onChange({ ...effect, durationMs: v })}
            tip="0 = instant cut"
          />
        </div>
      )}

      {effect.kind === 'background' && (
        <input
          type="color"
          value={hslToHex(effect.hsl)}
          onChange={(e) => onChange({ kind: 'background', hsl: hexToHsl(e.target.value) })}
          title="Background HSL override"
          className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
        />
      )}

      {effect.kind === 'light' && (
        <div className="space-y-2">
          <input
            type="color"
            value={hslToHex(effect.hsl)}
            onChange={(e) => onChange({ ...effect, hsl: hexToHsl(e.target.value) })}
            title="Light color"
            className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent"
          />
          <Slider
            label={`intensity ${effect.intensity.toFixed(2)}`}
            min={0}
            max={5}
            step={0.1}
            value={effect.intensity}
            onChange={(v) => onChange({ ...effect, intensity: v })}
            tip="Key light intensity override"
          />
        </div>
      )}
    </div>
  );
}
