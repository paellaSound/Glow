'use client';

import { FOV_PRESETS } from '../constants';
import type { SandboxState } from '../useSandboxState';
import { Empty, Label, SectionTip, Slider } from '../widgets';

type Props = Pick<
  SandboxState,
  'editingLevel' | 'lvl' | 'insp' | 'setFov' | 'captureCameraToLevel' | 'setCameraSource'
>;

export function CameraPanel({ editingLevel, lvl, insp, setFov, captureCameraToLevel, setCameraSource }: Props) {
  if (!insp) return <Empty>Load a GLB on this level to edit framing.</Empty>;

  return (
    <div className="space-y-3">
      <Label>Framing · level {editingLevel}</Label>
      <SectionTip>Orbit the viewport in free mode, then capture. Audio bindings can drive FOV / dolly / shake at runtime.</SectionTip>

      <div className="flex items-center gap-2">
        <span className="w-12 text-zinc-500">source</span>
        <div className="flex flex-1 gap-1">
          <button
            onClick={() => setCameraSource('engine')}
            title="Use per-level camera from config"
            className={`flex-1 rounded py-1 text-[11px] ${
              lvl.cameraSource === 'engine' ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            engine
          </button>
          <button
            onClick={() => setCameraSource('glb')}
            disabled={!insp.hasCamera}
            title={insp.hasCamera ? 'Use camera baked in GLB' : 'This GLB has no camera'}
            className={`flex-1 rounded py-1 text-[11px] disabled:opacity-40 ${
              lvl.cameraSource === 'glb' ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            GLB {insp.hasCamera ? '' : '✕'}
          </button>
        </div>
      </div>

      {lvl.cameraSource === 'engine' ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600">Orbit to frame, then capture</span>
            <button
              onClick={captureCameraToLevel}
              title="Save current orbit view to this level"
              className="rounded bg-zinc-800 px-2 py-0.5 text-cyan-300 hover:bg-zinc-700"
            >
              capture → L{editingLevel}
            </button>
          </div>
          <Slider
            label={`FOV ${lvl.camera.fov.toFixed(0)}°`}
            min={10}
            max={120}
            step={1}
            value={lvl.camera.fov}
            onChange={setFov}
            tip="Vertical field of view in degrees"
          />
          <div className="flex gap-1">
            {FOV_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setFov(p.fov)}
                title={`${p.label} ≈ ${p.fov}°`}
                className="flex-1 rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[10px] text-zinc-600">Using the GLB&apos;s baked camera for this level.</p>
      )}
    </div>
  );
}
