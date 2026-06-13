'use client';

/**
 * Decoupled 3D scene player — /dev/visuals3d/play[?scene=<id>].
 *
 * Loads a scene saved by the sandbox (config + GLB/HDR blobs from IndexedDB) and
 * renders it with the SAME config-driven engine the projector would use — only
 * energy / action / mic controls, no authoring UI. This is the dev proof that a
 * scene runs purely from its config + source files, decoupled from the editor
 * and without touching the production energy-orb. It mirrors what Nivel 2 will
 * do once the assets live in Supabase instead of IndexedDB.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mountSandboxScene,
  MAX_ENERGY,
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
      controller.setEnergyLevels(scene.config.energyLevels);
      controller.setTransitionMode(scene.config.transition);
      controller.setPaletteTargets(scene.config.paletteTargets);
      controller.setAudioBindings(scene.config.audioBindings);
      controller.setExposure(scene.config.exposure);
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

  const actions = config?.energyLevels[level]?.actions ?? [];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-zinc-200">
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

      {/* Playback controls */}
      {loadedName && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 rounded-2xl bg-zinc-950/80 px-5 py-3 font-mono text-xs backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">{loadedName}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">energy</span>
            <div className="flex gap-1">
              {Array.from({ length: MAX_ENERGY + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setEnergy(i)}
                  className={`h-8 w-8 rounded ${
                    i === level ? 'bg-cyan-500 font-bold text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMicOn((v) => !v)}
              className={`rounded px-3 py-1.5 ${
                micActive ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🎤
            </button>
            <Link href="/dev/visuals3d" className="text-zinc-500 hover:text-zinc-300">
              edit
            </Link>
          </div>
          {actions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">actions</span>
              {actions.map((clip) => (
                <button
                  key={clip}
                  onClick={() => controllerRef.current?.playAction(level, clip)}
                  className="rounded bg-violet-500/20 px-3 py-1 text-violet-200 ring-1 ring-violet-500/40 hover:bg-violet-500/30"
                >
                  {clip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
