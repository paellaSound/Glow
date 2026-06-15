'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mountSandboxScene,
  ENERGY_LEVEL_COUNT,
  type Action,
  type ActionTrigger,
  type AudioBinding,
  type AudioSource,
  type CameraMode,
  type EnergyLevelConfig,
  type EnergyMode,
  type SandboxController,
  type SandboxInput,
  type SceneInspection,
  type TransitionMode,
} from 'glow-visuals-3d';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import {
  deleteScene,
  listScenes,
  loadScene,
  saveScene,
  type SceneMeta,
  type StoredAsset,
} from '../scene-store';
import { makeZip, unzip, type ZipEntry } from '../zip';
import {
  DEFAULT_BINDINGS,
  DEFAULT_PALETTE,
  TEST_GLB_URL,
  ZIP_README,
  type OutlinerSelection,
  type Workspace,
} from './constants';
import { allClipsFromInspection, emptyLevels, ext, normalizeLevel } from './utils';

export function useSandboxState() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<SandboxController | null>(null);
  const inputRef = useRef<SandboxInput>({ timeMs: 0, palette: DEFAULT_PALETTE, audio: undefined });
  const assetsRef = useRef<{ glbs: Map<number, StoredAsset>; hdr?: StoredAsset }>({ glbs: new Map() });
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const [levels, setLevels] = useState<EnergyLevelConfig[]>(emptyLevels());
  const [levelInspection, setLevelInspection] = useState<(SceneInspection | null)[]>(
    Array(ENERGY_LEVEL_COUNT).fill(null),
  );
  const [editingLevel, setEditingLevel] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace>('levels');
  const [selection, setSelection] = useState<OutlinerSelection>({ kind: 'level', level: 0 });
  const [transitionMode, setTransitionMode] = useState<TransitionMode>('crossfade');
  const [cameraMode, setCameraMode] = useState<CameraMode>('free');
  const [energyMode, setEnergyMode] = useState<EnergyMode>('manual');
  const [autoDwellMs, setAutoDwellMs] = useState(4000);
  const [autoSilenceFloor, setAutoSilenceFloor] = useState(0.04);
  const [triggers, setTriggers] = useState<ActionTrigger[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  const [hdrName, setHdrName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [paletteTargets, setPaletteTargets] = useState<string[]>([]);
  const [bindings, setBindings] = useState<AudioBinding[]>(DEFAULT_BINDINGS);
  const [exposure, setExposure] = useState(1);
  const [useHdrBg, setUseHdrBg] = useState(false);
  const [micOn, setMicOn] = useState(false);

  const [sceneName, setSceneName] = useState('my-scene');
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { featuresRef, active: micActive, error: micError } = useAudioAnalyzer({ enabled: micOn });

  const refreshLibrary = useCallback(() => {
    void listScenes().then(setScenes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canvasRef.current || controllerRef.current) return;
    controllerRef.current = mountSandboxScene(canvasRef.current, () => inputRef.current);
    const onResize = () => controllerRef.current?.resize();
    window.addEventListener('resize', onResize);
    refreshLibrary();
    return () => {
      window.removeEventListener('resize', onResize);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [refreshLibrary]);

  useEffect(() => {
    inputRef.current = { ...inputRef.current, palette };
  }, [palette]);

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

  useEffect(() => controllerRef.current?.setPaletteTargets(paletteTargets), [paletteTargets]);
  useEffect(() => controllerRef.current?.setAudioBindings(bindings), [bindings]);
  useEffect(() => controllerRef.current?.setEnergyLevels(levels), [levels]);
  useEffect(() => controllerRef.current?.setTransitionMode(transitionMode), [transitionMode]);
  useEffect(() => controllerRef.current?.setEnergyMode(energyMode), [energyMode]);
  useEffect(
    () => controllerRef.current?.setAutoConfig({ dwellMs: autoDwellMs, silenceFloor: autoSilenceFloor }),
    [autoDwellMs, autoSilenceFloor],
  );
  useEffect(() => controllerRef.current?.setActionTriggers(triggers), [triggers]);
  useEffect(() => controllerRef.current?.setActions(actions), [actions]);
  useEffect(() => controllerRef.current?.setExposure(exposure), [exposure]);
  useEffect(() => controllerRef.current?.setUseHdrBackground(useHdrBg), [useHdrBg]);
  useEffect(() => controllerRef.current?.setCameraMode(cameraMode), [cameraMode]);
  useEffect(() => controllerRef.current?.setEnergy(editingLevel), [editingLevel]);

  useEffect(() => {
    if (cameraMode === 'free') controllerRef.current?.applyCameraView(levels[editingLevel]!.camera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLevel]);

  const selectLevel = useCallback((level: number) => {
    setEditingLevel(level);
    setSelection({ kind: 'level', level });
  }, []);

  const loadGlbBlob = useCallback(
    async (level: number, blob: Blob, name: string, resetMeta: boolean) => {
      const controller = controllerRef.current;
      if (!controller) return;
      const firstModel = assetsRef.current.glbs.size === 0;
      setError(null);
      setLoading(true);
      const url = URL.createObjectURL(blob);
      try {
        const found = await controller.loadGlbForLevel(level, url, name);
        assetsRef.current.glbs.set(level, { name, blob });
        setLevelInspection((prev) => prev.map((p, i) => (i === level ? found : p)));
        if (resetMeta) {
          const guessIdle =
            found.clips.find((c) => c.toLowerCase() === 'idle') ?? found.clips[0] ?? null;
          setLevels((prev) =>
            prev.map((lv, i) =>
              i === level
                ? { ...lv, glb: name, clipPool: guessIdle ? [guessIdle] : [] }
                : lv,
            ),
          );
          if (firstModel) {
            const cam = controller.captureCamera();
            setLevels((prev) => prev.map((lv) => ({ ...lv, camera: cam })));
          }
        }
      } catch (err) {
        setError(`Failed to load ${name}: ${(err as Error).message}`);
      } finally {
        setLoading(false);
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const loadHdrBlob = useCallback(async (blob: Blob, name: string) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const url = URL.createObjectURL(blob);
    try {
      await controller.loadHdr(url, name);
      assetsRef.current.hdr = { name, blob };
      setHdrName(name);
    } catch (err) {
      setError(`Failed to load HDR: ${(err as Error).message}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const kind = ext(file.name);
      if (kind === 'glb' || kind === 'gltf') await loadGlbBlob(editingLevel, file, file.name, true);
      else if (kind === 'hdr' || kind === 'exr') await loadHdrBlob(file, file.name);
      else setError(`Unsupported file: .${kind} (drop a .glb / .gltf or .hdr)`);
    },
    [editingLevel, loadGlbBlob, loadHdrBlob],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      Array.from(e.dataTransfer.files).forEach((f) => void loadFile(f));
    },
    [loadFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const useTestGlb = useCallback(async () => {
    const res = await fetch(TEST_GLB_URL);
    const blob = await res.blob();
    await loadGlbBlob(editingLevel, blob, 'goku.glb (test)', true);
  }, [editingLevel, loadGlbBlob]);

  const updateLevel = useCallback(
    (patch: Partial<EnergyLevelConfig>) => {
      setLevels((prev) => prev.map((lv, i) => (i === editingLevel ? { ...lv, ...patch } : lv)));
    },
    [editingLevel],
  );

  const setFov = useCallback(
    (fov: number) => {
      setLevels((prev) =>
        prev.map((lv, i) =>
          i === editingLevel ? { ...lv, camera: { ...lv.camera, fov } } : lv,
        ),
      );
      controllerRef.current?.previewFov(fov);
    },
    [editingLevel],
  );

  const captureCameraToLevel = useCallback(() => {
    const cam = controllerRef.current?.captureCamera();
    if (cam) updateLevel({ camera: cam });
  }, [updateLevel]);

  const setCameraSource = useCallback(
    (src: 'engine' | 'glb') => {
      updateLevel({ cameraSource: src });
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      if (src === 'glb') {
        const cam = ctrl.getGlbCamera(editingLevel);
        if (cam) ctrl.applyCameraView(cam);
      } else {
        ctrl.applyCameraView(levels[editingLevel]!.camera);
      }
    },
    [editingLevel, levels, updateLevel],
  );

  const toggleClipInPool = useCallback(
    (clip: string) => {
      setLevels((prev) =>
        prev.map((lv, i) => {
          if (i !== editingLevel) return lv;
          const inPool = lv.clipPool.includes(clip);
          return {
            ...lv,
            clipPool: inPool ? lv.clipPool.filter((c) => c !== clip) : [...lv.clipPool, clip],
          };
        }),
      );
    },
    [editingLevel],
  );

  const toggleTarget = useCallback((name: string) => {
    setPaletteTargets((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }, []);

  const updateBinding = useCallback((i: number, patch: Partial<AudioBinding>) => {
    setBindings((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }, []);

  const addBinding = useCallback(() => {
    setBindings((prev) => [
      ...prev,
      { source: 'bass', target: 'scale', amount: 0.3, smoothing: 0.5, enabled: true },
    ]);
  }, []);

  const removeBinding = useCallback((i: number) => {
    setBindings((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const addTrigger = useCallback(() => {
    setTriggers((prev) => [
      ...prev,
      {
        source: 'bass' as AudioSource,
        threshold: 0.7,
        actionId: actions[0]?.id ?? '',
        cooldownMs: 800,
        enabled: true,
      },
    ]);
  }, [actions]);

  const updateTrigger = useCallback((i: number, patch: Partial<ActionTrigger>) => {
    setTriggers((prev) => prev.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)));
  }, []);

  const removeTrigger = useCallback((i: number) => {
    setTriggers((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const addAction = useCallback(() => {
    setActions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `action ${prev.length + 1}`,
        effects: [],
        transition: { mode: 'cut' as const, durationMs: 0 },
      },
    ]);
  }, []);

  const updateAction = useCallback((id: string, patch: Partial<Action>) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    const id = sceneName.trim() || 'scene';
    const config = controller.readConfig({
      paletteTargets,
      energyLevels: levels,
      actions,
      audioBindings: bindings,
      transition: transitionMode,
      energyMode,
      autoConfig: { dwellMs: autoDwellMs, silenceFloor: autoSilenceFloor },
      actionTriggers: triggers,
      hdrName,
    });
    const glbs: Record<number, StoredAsset> = {};
    assetsRef.current.glbs.forEach((asset, level) => {
      glbs[level] = asset;
    });
    try {
      await saveScene({
        id,
        name: id,
        savedAt: Date.now(),
        palette,
        config,
        glbs,
        hdr: assetsRef.current.hdr,
      });
      setSavedMsg(`saved "${id}"`);
      setTimeout(() => setSavedMsg(null), 2500);
      refreshLibrary();
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`);
    }
  }, [
    actions,
    autoDwellMs,
    autoSilenceFloor,
    bindings,
    energyMode,
    hdrName,
    levels,
    palette,
    paletteTargets,
    refreshLibrary,
    sceneName,
    transitionMode,
    triggers,
  ]);

  const handleLoadScene = useCallback(
    async (id: string) => {
      const scene = await loadScene(id);
      if (!scene) return;
      setSceneName(scene.name);
      setLevels(scene.config.energyLevels.map((lv, i) => normalizeLevel(lv, i)));
      setTransitionMode(scene.config.transition);
      setPalette(scene.palette);
      setPaletteTargets(scene.config.paletteTargets);
      setBindings(scene.config.audioBindings);
      setEnergyMode(scene.config.energyMode ?? 'manual');
      setAutoDwellMs(scene.config.autoConfig?.dwellMs ?? 4000);
      setAutoSilenceFloor(scene.config.autoConfig?.silenceFloor ?? 0.04);
      setTriggers(scene.config.actionTriggers ?? []);
      setActions(scene.config.actions ?? []);
      setExposure(scene.config.exposure);
      assetsRef.current = { glbs: new Map(), hdr: scene.hdr };
      setLevelInspection(Array(ENERGY_LEVEL_COUNT).fill(null));
      for (const [levelStr, asset] of Object.entries(scene.glbs)) {
        await loadGlbBlob(Number(levelStr), asset.blob, asset.name, false);
      }
      if (scene.hdr) await loadHdrBlob(scene.hdr.blob, scene.hdr.name);
      setUseHdrBg(scene.config.useHdrBackground);
      selectLevel(0);
    },
    [loadGlbBlob, loadHdrBlob, selectLevel],
  );

  const handleDeleteScene = useCallback(
    async (id: string) => {
      await deleteScene(id);
      refreshLibrary();
    },
    [refreshLibrary],
  );

  const handleExportZip = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    const enc = new TextEncoder();
    const config = controller.readConfig({
      paletteTargets,
      energyLevels: levels,
      actions,
      audioBindings: bindings,
      transition: transitionMode,
      energyMode,
      autoConfig: { dwellMs: autoDwellMs, silenceFloor: autoSilenceFloor },
      actionTriggers: triggers,
      hdrName,
    });
    const exportConfig = {
      ...config,
      palette,
      hdr: assetsRef.current.hdr ? 'environment.hdr' : null,
      energyLevels: config.energyLevels.map((lv, i) => ({
        ...lv,
        glb: assetsRef.current.glbs.has(i) ? `glb/level-${i}.glb` : null,
      })),
    };
    const entries: ZipEntry[] = [
      { name: 'scene.json', data: enc.encode(JSON.stringify(exportConfig, null, 2)) },
      { name: 'README.txt', data: enc.encode(ZIP_README) },
    ];
    for (const [level, asset] of assetsRef.current.glbs) {
      entries.push({ name: `glb/level-${level}.glb`, data: new Uint8Array(await asset.blob.arrayBuffer()) });
    }
    if (assetsRef.current.hdr) {
      entries.push({
        name: 'environment.hdr',
        data: new Uint8Array(await assetsRef.current.hdr.blob.arrayBuffer()),
      });
    }
    const blob = makeZip(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sceneName.trim() || 'scene'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    actions,
    autoDwellMs,
    autoSilenceFloor,
    bindings,
    energyMode,
    hdrName,
    levels,
    palette,
    paletteTargets,
    sceneName,
    transitionMode,
    triggers,
  ]);

  const handleImportZip = useCallback(
    async (file: File) => {
      const controller = controllerRef.current;
      if (!controller) return;
      setError(null);
      setLoading(true);
      try {
        const map = await unzip(file);
        const sceneBytes = map.get('scene.json');
        if (!sceneBytes) throw new Error('scene.json missing in zip');
        const cfg = JSON.parse(new TextDecoder().decode(sceneBytes));

        setSceneName(file.name.replace(/\.zip$/i, ''));
        setLevels(
          (cfg.energyLevels as Partial<EnergyLevelConfig>[]).map((lv, i) =>
            normalizeLevel(
              { ...lv, glb: map.has(`glb/level-${i}.glb`) ? `level-${i}.glb` : null },
              i,
            ),
          ),
        );
        setTransitionMode(cfg.transition ?? 'crossfade');
        setPalette(cfg.palette ?? DEFAULT_PALETTE);
        setPaletteTargets(cfg.paletteTargets ?? []);
        setBindings(cfg.audioBindings ?? DEFAULT_BINDINGS);
        setEnergyMode(cfg.energyMode ?? 'manual');
        setAutoDwellMs(cfg.autoConfig?.dwellMs ?? 4000);
        setAutoSilenceFloor(cfg.autoConfig?.silenceFloor ?? 0.04);
        setTriggers(cfg.actionTriggers ?? []);
        setActions(cfg.actions ?? []);
        setExposure(cfg.exposure ?? 1);
        assetsRef.current = { glbs: new Map(), hdr: undefined };
        setLevelInspection(Array(ENERGY_LEVEL_COUNT).fill(null));

        for (let i = 0; i < ENERGY_LEVEL_COUNT; i++) {
          const bytes = map.get(`glb/level-${i}.glb`);
          if (bytes) {
            await loadGlbBlob(
              i,
              new Blob([bytes as BlobPart], { type: 'model/gltf-binary' }),
              `level-${i}.glb`,
              false,
            );
          }
        }
        const hdrBytes = map.get('environment.hdr');
        if (hdrBytes) await loadHdrBlob(new Blob([hdrBytes as BlobPart]), 'environment.hdr');
        setUseHdrBg(cfg.useHdrBackground ?? false);
        selectLevel(0);
      } catch (err) {
        setError(`Import failed: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [loadGlbBlob, loadHdrBlob, selectLevel],
  );

  const lvl = levels[editingLevel]!;
  const insp = levelInspection[editingLevel];
  const anyGlb = levels.some((l) => l.glb) || assetsRef.current.glbs.size > 0;
  const allClips = allClipsFromInspection(levelInspection);

  return {
    canvasRef,
    controllerRef,
    zipInputRef,
    levels,
    levelInspection,
    editingLevel,
    workspace,
    setWorkspace,
    selection,
    setSelection,
    selectLevel,
    transitionMode,
    setTransitionMode,
    cameraMode,
    setCameraMode,
    energyMode,
    setEnergyMode,
    autoDwellMs,
    setAutoDwellMs,
    autoSilenceFloor,
    setAutoSilenceFloor,
    triggers,
    actions,
    hdrName,
    loading,
    error,
    dragging,
    palette,
    setPalette,
    paletteTargets,
    bindings,
    exposure,
    setExposure,
    useHdrBg,
    setUseHdrBg,
    micOn,
    setMicOn,
    micActive,
    micError,
    sceneName,
    setSceneName,
    scenes,
    savedMsg,
    lvl,
    insp,
    anyGlb,
    allClips,
    onDrop,
    onDragOver,
    onDragLeave,
    useTestGlb,
    updateLevel,
    setFov,
    captureCameraToLevel,
    setCameraSource,
    toggleClipInPool,
    toggleTarget,
    updateBinding,
    addBinding,
    removeBinding,
    addTrigger,
    updateTrigger,
    removeTrigger,
    addAction,
    updateAction,
    removeAction,
    handleSave,
    handleLoadScene,
    handleDeleteScene,
    handleExportZip,
    handleImportZip,
  };
}

export type SandboxState = ReturnType<typeof useSandboxState>;
