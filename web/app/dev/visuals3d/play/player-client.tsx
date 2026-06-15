'use client';

/**
 * Decoupled 3D scene player — /dev/visuals3d/play[?scene=<id>].
 *
 * Loads a scene saved by the sandbox (config + GLB/HDR blobs from IndexedDB) and
 * renders it with the SAME config-driven engine the projector would use — only
 * energy / action / mic controls, no authoring UI. This is the dev proof that a
 * scene runs purely from its config + source files, decoupled from the editor
 * and without touching the production energy-orb. It mirrors what Level 2 will
 * do once the assets live in Supabase instead of IndexedDB.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mountSandboxScene,
  MAX_ENERGY,
  DEFAULT_LIGHT,
  DEFAULT_POOL_PLAYBACK,
  type EnergyMode,
  type SandboxController,
  type SandboxInput,
  type Scene3DConfig,
} from 'glow-visuals-3d';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import { listScenes, loadScene, type SceneMeta } from '../scene-store';

export default function Visuals3DPlayerClient({ sceneId }: { sceneId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<SandboxController | null>(null);
  const inputRef = useRef<SandboxInput>({ timeMs: 0, palette: ['#00e3ff'], audio: undefined });

  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [config, setConfig] = useState<Scene3DConfig | null>(null);
  const [level, setLevel] = useState(0);
  const [energyMode, setEnergyMode] = useState<EnergyMode>('manual');
  const [poolLocked, setPoolLocked] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { featuresRef, active: micActive } = useAudioAnalyzer({ enabled: micOn });

  const loadById = useCallback(async (id: string) => {
    const controller = controllerRef.current;
    if (!controller) return;
    setError(null);
    try {
      const scene = await loadScene(id);
      if (!scene) {
        setError(`Scene "${id}" not found`);
        return;
      }
      inputRef.current = { ...inputRef.current, palette: scene.palette };
      // Backfill v2 fields for scenes saved before schemaVersion 2.
      const levels = scene.config.energyLevels.map((lv, i) => ({
        glb: lv.glb ?? null,
        hsl: lv.hsl ?? { h: 0.62, s: 0.55, l: 0.04 + (i / MAX_ENERGY) * 0.04 },
        light: lv.light ?? DEFAULT_LIGHT,
        clipPool: lv.clipPool ?? [],
        poolPlayback: lv.poolPlayback ?? DEFAULT_POOL_PLAYBACK,
        camera: lv.camera ?? {
          position: [3.5, 2, 5] as [number, number, number],
          target: [0, 1, 0] as [number, number, number],
          fov: 50,
        },
        cameraSource: lv.cameraSource ?? 'engine',
      }));
      controller.setEnergyLevels(levels);
      controller.setTransitionMode(scene.config.transition);
      controller.setPaletteTargets(scene.config.paletteTargets);
      controller.setAudioBindings(scene.config.audioBindings);
      controller.setActionTriggers(scene.config.actionTriggers ?? []);
      controller.setActions(scene.config.actions ?? []);
      controller.setAutoConfig(scene.config.autoConfig ?? { dwellMs: 4000, silenceFloor: 0.04 });
      const mode = scene.config.energyMode ?? 'manual';
      controller.setEnergyMode(mode);
      controller.setExposure(scene.config.exposure);
      // The player is the projector view: the engine owns the camera.
      controller.setCameraMode('driven');
      for (const [levelStr, asset] of Object.entries(scene.glbs)) {
        const url = URL.createObjectURL(asset.blob);
        await controller.loadGlbForLevel(Number(levelStr), url, asset.name);
        URL.revokeObjectURL(url);
      }
      if (scene.hdr) {
        const url = URL.createObjectURL(scene.hdr.blob);
        await controller.loadHdr(url, scene.hdr.name);
        URL.revokeObjectURL(url);
      }
      controller.setUseHdrBackground(scene.config.useHdrBackground);
      controller.setEnergy(0);
      setLevel(0);
      setEnergyMode(mode);
      setPoolLocked(false);
      setConfig(scene.config);
      setLoadedName(scene.name);
    } catch (err) {
      setError(`Load failed: ${(err as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || controllerRef.current) return;
    controllerRef.current = mountSandboxScene(canvasRef.current, () => inputRef.current);
    const onResize = () => controllerRef.current?.resize();
    window.addEventListener('resize', onResize);
    void listScenes().then(setScenes).catch(() => {});
    if (sceneId) void loadById(sceneId);
    return () => {
      window.removeEventListener('resize', onResize);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [loadById, sceneId]);

  useEffect(() => {
    if (!micActive) {
      inputRef.current = { ...inputRef.current, audio: undefined };
      return;
    }
    let raf = 0;
    const tick = () => {
      inputRef.current.audio = featuresRef.current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [micActive, featuresRef]);

  function setEnergy(n: number) {
    setLevel(n);
    controllerRef.current?.setEnergy(n);
  }

  function setMode(mode: EnergyMode) {
    setEnergyMode(mode);
    controllerRef.current?.setEnergyMode(mode);
  }

  function togglePoolLock() {
    controllerRef.current?.lockCurrentClip();
    setPoolLocked((v) => !v);
  }

  function skipPoolClip() {
    controllerRef.current?.skipClip();
  }

  const sceneActions = config?.actions ?? [];

  function playSceneAction(actionId: string) {
    controllerRef.current?.playActionById(actionId);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-zinc-100">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: 'block' }} />

      {/* Scene picker (shown until a scene is loaded) */}
      {!loadedName && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-80 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 font-mono text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-sm font-bold tracking-widest text-cyan-300">3D PLAYER</h1>
              <Link href="/dev/visuals3d" className="text-zinc-400 hover:text-zinc-200">
                ← sandbox
              </Link>
            </div>
            <p className="mb-3 text-[11px] text-zinc-500">Pick a saved scene to render it from its config.</p>
            {scenes.length === 0 && (
              <p className="text-[11px] italic text-zinc-600">
                No saved scenes. Author one in the sandbox and Save it.
              </p>
            )}
            {scenes.map((s) => (
              <button
                key={s.id}
                onClick={() => void loadById(s.id)}
                className="mb-1.5 flex w-full items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-cyan-500/40"
              >
                <span className="truncate text-zinc-200">{s.name}</span>
                <span className="text-[10px] text-zinc-600">lvls {s.levels.join(',') || '—'}</span>
              </button>
            ))}
            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
          </div>
        </div>
      )}

      {/* Live control deck — bottom bar, high contrast for dark-room operation */}
      {loadedName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
          <div className="pointer-events-auto mx-auto max-w-5xl px-4 font-mono">
            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 shadow-2xl backdrop-blur-sm">
              {/* Row 1: scene name + edit */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="truncate text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                  {loadedName}
                </span>
                <Link
                  href="/dev/visuals3d"
                  className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-200 hover:bg-zinc-700"
                >
                  edit
                </Link>
              </div>

              {/* Row 2: energy 0–5 + manual/auto */}
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  energy
                </span>
                <div className="flex gap-1.5">
                  {Array.from({ length: MAX_ENERGY + 1 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setEnergy(i)}
                      title={`Energy level ${i}`}
                      className={`h-12 w-12 rounded-lg text-lg font-bold transition-colors ${
                        i === level
                          ? 'bg-cyan-400 text-black ring-2 ring-cyan-200'
                          : 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">mode</span>
                  <div className="flex gap-1">
                    {(['manual', 'auto'] as EnergyMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        title={m === 'manual' ? 'You pick the energy level' : 'Song average energy drives level'}
                        className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                          energyMode === m
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: action buttons */}
              {sceneActions.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    actions
                  </span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {sceneActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => playSceneAction(action.id)}
                        title={`Fire action: ${action.name}`}
                        className="min-h-12 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-violet-500/20 ring-1 ring-violet-300/50 hover:bg-violet-400 active:scale-[0.98]"
                      >
                        {action.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 4: pool lock/skip + mic */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">pool</span>
                  <button
                    onClick={togglePoolLock}
                    title="Lock/unlock current pool clip"
                    className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold ${
                      poolLocked
                        ? 'bg-amber-400 text-black ring-2 ring-amber-200'
                        : 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700'
                    }`}
                  >
                    🔒 lock
                  </button>
                  <button
                    onClick={skipPoolClip}
                    title="Skip to next pool clip"
                    className="min-h-11 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
                  >
                    ⏭ skip
                  </button>
                </div>
                <button
                  onClick={() => setMicOn((v) => !v)}
                  title={micActive ? 'Mic on — audio reactivity + triggers' : 'Enable laptop mic'}
                  className={`min-h-11 rounded-lg px-5 py-2 text-sm font-bold ${
                    micActive
                      ? 'bg-cyan-400 text-black ring-2 ring-cyan-200'
                      : 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700'
                  }`}
                >
                  🎤 mic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
