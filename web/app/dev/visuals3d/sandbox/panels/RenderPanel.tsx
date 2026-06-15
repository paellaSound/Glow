'use client';

import type { CameraMode, TransitionMode } from 'glow-visuals-3d';
import type { SandboxState } from '../useSandboxState';
import { Label, Row, SectionTip, Slider } from '../widgets';

type Props = Pick<
  SandboxState,
  | 'transitionMode'
  | 'setTransitionMode'
  | 'cameraMode'
  | 'setCameraMode'
  | 'exposure'
  | 'setExposure'
  | 'hdrName'
  | 'useHdrBg'
  | 'setUseHdrBg'
  | 'micOn'
  | 'setMicOn'
  | 'micActive'
  | 'micError'
>;

export function RenderPanel({
  transitionMode,
  setTransitionMode,
  cameraMode,
  setCameraMode,
  exposure,
  setExposure,
  hdrName,
  useHdrBg,
  setUseHdrBg,
  micOn,
  setMicOn,
  micActive,
  micError,
}: Props) {
  return (
    <div className="space-y-3">
      <Label>Render / scene</Label>
      <SectionTip>Global render settings. Use driven camera mode to preview runtime framing.</SectionTip>

      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-500">transition</span>
        <div className="flex flex-1 gap-1">
          {(['crossfade', 'cut'] as TransitionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setTransitionMode(m)}
              title={`Level model transition: ${m}`}
              className={`flex-1 rounded py-1 ${
                transitionMode === m ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-500">camera</span>
        <div className="flex flex-1 gap-1">
          {(['free', 'driven'] as CameraMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setCameraMode(m)}
              title={m === 'free' ? 'Orbit freely (authoring)' : 'Runtime camera (per-level + audio)'}
              className={`flex-1 rounded py-1 ${
                cameraMode === m ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label={`exposure ${exposure.toFixed(2)}`}
        min={0.1}
        max={3}
        step={0.05}
        value={exposure}
        onChange={setExposure}
        tip="Tone mapping exposure"
      />

      <Row k="HDR" v={hdrName ?? '—'} />

      <label className="flex items-center gap-2" title="Replace background with HDR environment">
        <input
          type="checkbox"
          checked={useHdrBg}
          disabled={!hdrName}
          onChange={(e) => setUseHdrBg(e.target.checked)}
          className="accent-cyan-400"
        />
        <span className={hdrName ? '' : 'text-zinc-600'}>use HDR as background</span>
      </label>

      <button
        onClick={() => setMicOn((v) => !v)}
        title="Enable laptop mic for live audio reactivity"
        className={`w-full rounded px-3 py-1.5 ${
          micActive
            ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400'
            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
        }`}
      >
        {micActive ? '🎤 mic on — reacting to audio' : '🎤 use laptop mic'}
      </button>
      {micError && <p className="text-[11px] text-red-400">{micError}</p>}
    </div>
  );
}
