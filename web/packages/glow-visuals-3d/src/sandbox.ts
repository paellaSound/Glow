/**
 * sandbox — config-driven 3D scene mounter for the designer harness
 * (/dev/visuals3d).
 *
 * A "scene" is an energy curve of 6 levels (0–5). Each level owns its OWN GLB
 * (the same character with baked changes — hair, pose, environment), an HSL
 * tonality (background + a global ambient tint), one looping idle clip and N
 * triggerable action clips. As energy changes the runtime crossfades or hard-
 * cuts between the levels' models; the HSL interpolates continuously. Live mic
 * audio modulates the visible model through modular bindings. The exported
 * Scene3DConfig + the GLB/HDR source files are the handoff to the app.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AudioFeatures } from './types.js';

const DRACO_DECODER_PATH = '/draco/';
export const MAX_ENERGY = 5;
export const ENERGY_LEVEL_COUNT = MAX_ENERGY + 1; // 0..5
const CROSSFADE_MS = 500;

export type SceneInspection = {
  meshes: string[];
  materials: string[];
  clips: string[];
  /** Whether the GLB ships its own camera (lets the designer pick GLB vs engine). */
  hasCamera: boolean;
};

/** Audio bands extracted from the mic each frame (all 0–1). */
export type AudioSource = 'bass' | 'mid' | 'treble' | 'energy';
/** Scene properties an audio band can drive. */
export type AudioTarget =
  | 'scale'
  | 'emissive'
  | 'bgHue'
  | 'rotationY'
  | 'animationSpeed'
  | 'camFov'
  | 'camDolly'
  | 'camShake';

/** One modular audio→visual connection. `amount` = gain, `smoothing` = filter. */
export type AudioBinding = {
  source: AudioSource;
  target: AudioTarget;
  amount: number;
  smoothing: number;
  enabled: boolean;
};

/** How the scene moves from one level's model to the next. */
export type TransitionMode = 'crossfade' | 'cut';

/** manual = operator sets the level; auto = the song's average energy drives it. */
export type EnergyMode = 'manual' | 'auto';

/** Auto-energy tuning: how long to dwell on a level, and the silence floor. */
export type AutoConfig = { dwellMs: number; silenceFloor: number };

/** Key light per energy level. direction = unit vector toward which the light points. */
export type LightConfig = {
  hsl: HSL;
  intensity: number;
  direction: [number, number, number];
};

/** How the clip pool advances between idle animations. */
export type PoolPlayback = {
  mode: 'random' | 'sequential';
  minHoldMs: number;
};

/** One atomic effect inside a named action. */
export type Effect =
  | { kind: 'animation'; clip: string }
  | { kind: 'camera'; to: CameraConfig; durationMs: number }
  | { kind: 'background'; hsl: HSL }
  | { kind: 'light'; hsl: HSL; intensity: number };

/** Named bundle of effects that can be fired from a button or audio trigger. */
export type Action = {
  id: string;
  name: string;
  effects: Effect[];
  transition: { mode: 'cut' | 'crossfade'; durationMs: number };
};

/** Fire an action when an audio band crosses a threshold (rising edge + cooldown). */
export type ActionTrigger = {
  source: AudioSource;
  threshold: number;
  actionId: string;
  cooldownMs: number;
  enabled: boolean;
};

/** Hue/Saturation/Lightness, each 0–1. */
export type HSL = { h: number; s: number; l: number };

/** A camera framing: where it sits, what it looks at, and its vertical FOV (deg). */
export type CameraConfig = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

/** free = OrbitControls drive the view (authoring); driven = config + audio own it. */
export type CameraMode = 'free' | 'driven';

/** One authored snapshot of the scene at a given energy level. */
export type EnergyLevelConfig = {
  /** File name of this level's GLB (metadata; loaded via loadGlbForLevel). */
  glb: string | null;
  /** Background color + global ambient tint for this level. */
  hsl: HSL;
  /** Key light for this level (runtime interpolates between levels). */
  light: LightConfig;
  /** Idle clips that rotate while at this level. */
  clipPool: string[];
  /** How the clip pool advances between idle animations. */
  poolPlayback: PoolPlayback;
  /** Camera framing for this level (runtime interpolates between levels). */
  camera: CameraConfig;
  /** Use the engine's per-level camera, or the one baked into the GLB. */
  cameraSource: 'engine' | 'glb';
};

export type Scene3DConfig = {
  schemaVersion: 2;
  paletteTargets: string[];
  energyLevels: EnergyLevelConfig[];
  actions: Action[];
  audioBindings: AudioBinding[];
  transition: TransitionMode;
  /** manual = operator-driven level; auto = audio-driven (avg energy → level). */
  energyMode: EnergyMode;
  autoConfig: AutoConfig;
  actionTriggers: ActionTrigger[];
  exposure: number;
  hdrName: string | null;
  useHdrBackground: boolean;
};

export const DEFAULT_LIGHT: LightConfig = {
  hsl: { h: 0, s: 0, l: 1 },
  intensity: 2.2,
  direction: [4, 8, 4],
};

export const DEFAULT_POOL_PLAYBACK: PoolPlayback = { mode: 'random', minHoldMs: 6000 };

export type SandboxInput = {
  timeMs: number;
  palette: string[];
  audio?: AudioFeatures;
};

export type SandboxController = {
  /** Load/replace the GLB for one energy level; resolves with its contents. */
  loadGlbForLevel: (level: number, url: string, name: string) => Promise<SceneInspection>;
  loadHdr: (url: string, name: string) => Promise<void>;
  clearHdr: () => void;
  setPaletteTargets: (names: string[]) => void;
  setAudioBindings: (bindings: AudioBinding[]) => void;
  /** Per-level metadata (hsl, clip pool, light); GLBs are loaded separately. */
  setEnergyLevels: (levels: EnergyLevelConfig[]) => void;
  setTransitionMode: (mode: TransitionMode) => void;
  setEnergy: (level: number) => void;
  setEnergyMode: (mode: EnergyMode) => void;
  setAutoConfig: (cfg: AutoConfig) => void;
  setActionTriggers: (triggers: ActionTrigger[]) => void;
  setExposure: (value: number) => void;
  setUseHdrBackground: (use: boolean) => void;
  /** The camera baked into a level's GLB, if any (for the GLB/engine toggle). */
  getGlbCamera: (level: number) => CameraConfig | null;
  /** free = OrbitControls drive the view; driven = per-level config + audio. */
  setCameraMode: (mode: CameraMode) => void;
  /** Read the current OrbitControls view as a CameraConfig (authoring). */
  captureCamera: () => CameraConfig;
  /** Snap the live camera to a framing (used when selecting a level in free mode). */
  applyCameraView: (cam: CameraConfig) => void;
  /** Live FOV preview while editing (free mode). */
  previewFov: (fov: number) => void;
  /** Play one of a level's action clips once. */
  playAction: (level: number, clip: string) => void;
  setActions: (actions: Action[]) => void;
  playActionById: (id: string) => void;
  setLevelLight: (level: number, light: LightConfig) => void;
  lockCurrentClip: () => void;
  skipClip: () => void;
  /** Live audio for the UI meters: raw bands, per-binding smoothed values, the
   * normalized average energy (0–1), the auto-selected level, and which triggers
   * just fired (for a flash indicator). */
  getAudioDebug: () => {
    feats: AudioFeatures;
    bindings: number[];
    avgEnergy: number;
    autoLevel: number;
    triggersFired: boolean[];
  };
  readConfig: (partial: {
    paletteTargets: string[];
    energyLevels: EnergyLevelConfig[];
    actions: Action[];
    audioBindings: AudioBinding[];
    transition: TransitionMode;
    energyMode: EnergyMode;
    autoConfig: AutoConfig;
    actionTriggers: ActionTrigger[];
    hdrName: string | null;
  }) => Scene3DConfig;
  resize: () => void;
  destroy: () => void;
};

type LevelMaterial = {
  name: string;
  mat: THREE.Material;
  origTransparent: boolean;
  origOpacity: number;
};

type LevelModel = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  clips: Map<string, THREE.AnimationClip>;
  materials: LevelMaterial[];
  idleAction: THREE.AnimationAction | null;
  currentIdleName: string | null;
  glbCamera: CameraConfig | null;
  loopHandler: ((e: { action: THREE.AnimationAction }) => void) | null;
};

function hexColor(hex: string | undefined, fallback: number): THREE.Color {
  try {
    return new THREE.Color(hex ?? fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHsl(a: HSL, b: HSL, t: number): HSL {
  return { h: lerp(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
}

function lerpLight(a: LightConfig, b: LightConfig, t: number): LightConfig {
  return {
    hsl: lerpHsl(a.hsl, b.hsl, t),
    intensity: lerp(a.intensity, b.intensity, t),
    direction: [
      lerp(a.direction[0], b.direction[0], t),
      lerp(a.direction[1], b.direction[1], t),
      lerp(a.direction[2], b.direction[2], t),
    ],
  };
}

function lerpCamera(a: CameraConfig, b: CameraConfig, t: number): CameraConfig {
  return {
    position: [
      lerp(a.position[0], b.position[0], t),
      lerp(a.position[1], b.position[1], t),
      lerp(a.position[2], b.position[2], t),
    ],
    target: [
      lerp(a.target[0], b.target[0], t),
      lerp(a.target[1], b.target[1], t),
      lerp(a.target[2], b.target[2], t),
    ],
    fov: lerp(a.fov, b.fov, t),
  };
}

const NEUTRAL_LEVEL: EnergyLevelConfig = {
  glb: null,
  hsl: { h: 0.62, s: 0.5, l: 0.05 },
  light: DEFAULT_LIGHT,
  clipPool: [],
  poolPlayback: DEFAULT_POOL_PLAYBACK,
  camera: { position: [3.5, 2, 5], target: [0, 1, 0], fov: 50 },
  cameraSource: 'engine',
};

export function mountSandboxScene(
  canvas: HTMLCanvasElement,
  getInput: () => SandboxInput,
): SandboxController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);
  scene.fog = new THREE.Fog(0x05060f, 12, 60);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.set(0, 1.6, 6);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  // Ambient leans toward the level HSL (the "global tint"); key/fill stay neutral.
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 8, 4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(-5, 2, -3);
  scene.add(ambient, key, fill);

  const grid = new THREE.GridHelper(20, 20, 0x335577, 0x16202e);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.4;
  scene.add(grid);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTexture: THREE.Texture | null = null;
  let useHdrBackground = false;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const rgbeLoader = new RGBELoader();

  // Per-level loaded models (sparse — a level may inherit a neighbour's).
  const models = new Map<number, LevelModel>();
  let framed = false;

  // Config state
  let levels: EnergyLevelConfig[] = [NEUTRAL_LEVEL];
  let paletteTargets: string[] = [];
  let audioBindings: AudioBinding[] = [];
  let bindingState: number[] = [];
  let lastFeats: AudioFeatures = { bass: 0, mid: 0, treble: 0, energy: 0 };

  // Auto-energy (audio-driven level) + threshold action triggers.
  let energyMode: EnergyMode = 'manual';
  let autoDwellMs = 4000;
  let autoSilenceFloor = 0.04;
  let avgEnergy = 0; // slow EMA of feats.energy
  let energyMax = 0.001; // decaying peak for auto-normalization
  let normEnergy = 0; // avgEnergy normalized to 0–1
  let autoLevel = 0;
  let lastAutoChangeMs = 0;
  let actionTriggers: ActionTrigger[] = [];
  let triggerState: { lastFireMs: number; armed: boolean }[] = [];
  let transitionMode: TransitionMode = 'crossfade';
  let cameraMode: CameraMode = 'free';

  // Runtime state
  let energy = 0;
  let energySmooth = 0;
  let activeLevel = 0;
  let currentModel: LevelModel | null = null;
  let transition: { from: LevelModel; to: LevelModel; start: number } | null = null;
  let rafId = 0;
  let destroyed = false;
  let lastMs = performance.now();
  const startTime = performance.now();
  const hsl = { h: 0, s: 0, l: 0 };
  const tintColor = new THREE.Color();
  const bgBase = new THREE.Color();
  const camTmpPos = new THREE.Vector3();
  const camTmpTgt = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const keyLightColor = new THREE.Color();

  // Composite actions + temporary overrides (cleared on energy-level change).
  let actions: Action[] = [];
  let camOverride: {
    from: CameraConfig;
    to: CameraConfig;
    start: number;
    durationMs: number;
  } | null = null;
  let bgOverride: HSL | null = null;
  let lightOverride: { hsl: HSL; intensity: number } | null = null;

  // Clip pool state (keyed by active energy level, not by model).
  let poolLastSwitchMs = 0;
  let poolLocked = false;
  let poolIndex = 0;

  function levelAt(i: number): EnergyLevelConfig {
    return levels[Math.max(0, Math.min(levels.length - 1, i))] ?? NEUTRAL_LEVEL;
  }

  /** The camera a level actually uses: its GLB's baked one, or the engine framing. */
  function effectiveCamera(i: number): CameraConfig {
    const lv = levelAt(i);
    if (lv.cameraSource === 'glb') {
      const m = modelForLevel(i);
      if (m?.glbCamera) return m.glbCamera;
    }
    return lv.camera;
  }

  /** The model shown at a level: its own, else the nearest loaded neighbour. */
  function modelForLevel(level: number): LevelModel | null {
    if (models.has(level)) return models.get(level)!;
    for (let d = 1; d <= MAX_ENERGY; d++) {
      if (models.has(level - d)) return models.get(level - d)!;
      if (models.has(level + d)) return models.get(level + d)!;
    }
    return null;
  }

  function setModelOpacity(model: LevelModel, alpha: number) {
    model.materials.forEach(({ mat, origTransparent, origOpacity }) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (alpha >= 1) {
        m.transparent = origTransparent;
        m.opacity = origOpacity;
        m.depthWrite = true;
      } else {
        m.transparent = true;
        m.opacity = origOpacity * alpha;
        m.depthWrite = false;
      }
    });
  }

  function setModelIdle(model: LevelModel, name: string | null) {
    if (!model.mixer || name === model.currentIdleName) return;
    const clip = name ? model.clips.get(name) : null;
    if (!clip) {
      model.idleAction?.fadeOut(0.3);
      model.idleAction = null;
      model.currentIdleName = null;
      return;
    }
    const next = model.mixer.clipAction(clip);
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.reset().play();
    if (model.idleAction) next.crossFadeFrom(model.idleAction, 0.4, true);
    else next.fadeIn(0.3);
    model.idleAction = next;
    model.currentIdleName = name;
  }

  function pickInitialPoolClip(lv: EnergyLevelConfig): string | null {
    const pool = lv.clipPool;
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0]!;
    if (lv.poolPlayback.mode === 'random') {
      const idx = Math.floor(Math.random() * pool.length);
      poolIndex = idx;
      return pool[idx]!;
    }
    poolIndex = 0;
    return pool[0]!;
  }

  function pickNextPoolClip(
    pool: string[],
    current: string | null,
    mode: 'random' | 'sequential',
  ): string {
    if (pool.length <= 1) return pool[0] ?? '';
    if (mode === 'sequential') {
      poolIndex = (poolIndex + 1) % pool.length;
      return pool[poolIndex]!;
    }
    if (pool.length === 2) return pool.find((c) => c !== current) ?? pool[0]!;
    let pick: string;
    do {
      pick = pool[Math.floor(Math.random() * pool.length)]!;
    } while (pick === current);
    poolIndex = pool.indexOf(pick);
    return pick;
  }

  function syncPoolIdle(nowMs: number) {
    if (!currentModel) return;
    const lv = levelAt(activeLevel);
    const pool = lv.clipPool;
    if (pool.length === 0) {
      setModelIdle(currentModel, null);
      return;
    }
    const clip = pickInitialPoolClip(lv);
    setModelIdle(currentModel, clip);
    poolLastSwitchMs = nowMs;
  }

  function advancePoolClip(nowMs: number) {
    if (!currentModel) return;
    const lv = levelAt(activeLevel);
    const pool = lv.clipPool;
    if (pool.length <= 1) return;
    const next = pickNextPoolClip(pool, currentModel.currentIdleName, lv.poolPlayback.mode);
    setModelIdle(currentModel, next);
    poolLastSwitchMs = nowMs;
  }

  function onMixerLoop(e: { action: THREE.AnimationAction }) {
    if (!currentModel || e.action !== currentModel.idleAction) return;
    const lv = levelAt(activeLevel);
    const pool = lv.clipPool;
    if (pool.length <= 1 || poolLocked) return;
    const nowMs = performance.now();
    if (nowMs - poolLastSwitchMs < lv.poolPlayback.minHoldMs) return;
    advancePoolClip(nowMs);
  }

  function attachLoopListener(model: LevelModel) {
    if (!model.mixer) return;
    if (model.loopHandler) model.mixer.removeEventListener('loop', model.loopHandler as never);
    model.loopHandler = onMixerLoop;
    model.mixer.addEventListener('loop', model.loopHandler as never);
  }

  function readLiveCamera(): CameraConfig {
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
    };
  }

  function playActionById(id: string) {
    const action = actions.find((a) => a.id === id);
    if (!action) return;
    const nowMs = performance.now();
    for (const effect of action.effects) {
      switch (effect.kind) {
        case 'animation':
          playAction(activeLevel, effect.clip);
          break;
        case 'camera':
          camOverride = {
            from: readLiveCamera(),
            to: effect.to,
            start: nowMs,
            durationMs: effect.durationMs,
          };
          break;
        case 'background':
          bgOverride = effect.hsl;
          break;
        case 'light':
          lightOverride = { hsl: effect.hsl, intensity: effect.intensity };
          break;
      }
    }
  }

  function disposeModel(model: LevelModel) {
    if (model.mixer && model.loopHandler) {
      model.mixer.removeEventListener('loop', model.loopHandler as never);
    }
    scene.remove(model.root);
    model.mixer?.stopAllAction();
    model.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  function frameModel(root: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 2.2;
    camera.position.set(dist * 0.5, maxDim * 0.8, dist);
    controls.target.set(0, size.y * 0.5, 0);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();
    controls.update();
  }

  /** Center a model at the origin (feet on the grid). */
  function centerModel(root: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
  }

  async function loadGlbForLevel(level: number, url: string, _name: string): Promise<SceneInspection> {
    const gltf = await gltfLoader.loadAsync(url);
    if (destroyed) return { meshes: [], materials: [], clips: [], hasCamera: false };

    const existing = models.get(level);
    if (existing) {
      if (currentModel === existing) currentModel = null;
      disposeModel(existing);
      models.delete(level);
    }

    const root = gltf.scene;
    centerModel(root);
    root.visible = false;
    scene.add(root);

    const meshes: string[] = [];
    const materialNames = new Set<string>();
    const materials: LevelMaterial[] = [];
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name) meshes.push(mesh.name);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        if (m.name) materialNames.add(m.name);
        materials.push({
          name: m.name,
          mat: m,
          origTransparent: m.transparent,
          origOpacity: m.opacity,
        });
      });
    });

    const clips = new Map<string, THREE.AnimationClip>();
    let mixer: THREE.AnimationMixer | null = null;
    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((c) => clips.set(c.name, c));
    }

    // Extract a baked camera (if the GLB ships one) as a CameraConfig.
    let glbCamera: CameraConfig | null = null;
    const gcam = gltf.cameras?.find(
      (c) => (c as THREE.PerspectiveCamera).isPerspectiveCamera,
    ) as THREE.PerspectiveCamera | undefined;
    if (gcam) {
      root.updateMatrixWorld(true);
      const pos = new THREE.Vector3().setFromMatrixPosition(gcam.matrixWorld);
      const q = new THREE.Quaternion();
      gcam.getWorldQuaternion(q);
      const tgt = pos.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(q), 5);
      glbCamera = {
        position: [+pos.x.toFixed(3), +pos.y.toFixed(3), +pos.z.toFixed(3)],
        target: [+tgt.x.toFixed(3), +tgt.y.toFixed(3), +tgt.z.toFixed(3)],
        fov: +gcam.fov.toFixed(1),
      };
    }

    models.set(level, {
      root,
      mixer,
      clips,
      materials,
      idleAction: null,
      currentIdleName: null,
      glbCamera,
      loopHandler: null,
    });
    const loaded = models.get(level)!;
    attachLoopListener(loaded);

    if (!framed) {
      frameModel(root);
      framed = true;
    }
    // Force the visible model to refresh on the next frame.
    currentModel = null;

    return { meshes, materials: [...materialNames], clips: [...clips.keys()], hasCamera: !!glbCamera };
  }

  async function loadHdr(url: string, _name: string): Promise<void> {
    const tex = await rgbeLoader.loadAsync(url);
    if (destroyed) {
      tex.dispose();
      return;
    }
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    if (envTexture) envTexture.dispose();
    envTexture = env;
    scene.environment = env;
    if (useHdrBackground) scene.background = env;
  }

  function clearHdr() {
    scene.environment = null;
    if (envTexture) {
      envTexture.dispose();
      envTexture = null;
    }
    useHdrBackground = false;
  }

  function playAction(level: number, clipName: string) {
    const model = modelForLevel(level);
    if (!model?.mixer) return;
    const clip = model.clips.get(clipName);
    if (!clip) return;
    const action = model.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    model.idleAction?.setEffectiveWeight(0.35);
    action.reset().play();
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        model.idleAction?.setEffectiveWeight(1);
        model.mixer?.removeEventListener('finished', onFinished as never);
      }
    };
    model.mixer.addEventListener('finished', onFinished as never);
  }

  /** Pick the model for the active level; start a transition when it changes. */
  function syncActiveModel(nowMs: number) {
    const desiredLevel = Math.max(0, Math.min(MAX_ENERGY, Math.round(energySmooth)));
    const levelChanged = desiredLevel !== activeLevel;

    if (levelChanged) {
      camOverride = null;
      bgOverride = null;
      lightOverride = null;
      poolLastSwitchMs = nowMs;
      poolLocked = false;
    }

    if (levelChanged || !currentModel) {
      const next = modelForLevel(desiredLevel);
      activeLevel = desiredLevel;
      if (next && next !== currentModel) {
        if (transitionMode === 'cut' || !currentModel) {
          if (currentModel) {
            currentModel.root.visible = false;
            setModelOpacity(currentModel, 1);
          }
          next.root.visible = true;
          setModelOpacity(next, 1);
          currentModel = next;
        } else {
          next.root.visible = true;
          setModelOpacity(next, 0);
          transition = { from: currentModel, to: next, start: nowMs };
        }
      }
    }

    if (transition) {
      const p = clamp01((nowMs - transition.start) / CROSSFADE_MS);
      setModelOpacity(transition.from, 1 - p);
      setModelOpacity(transition.to, p);
      if (p >= 1) {
        transition.from.root.visible = false;
        setModelOpacity(transition.from, 1);
        currentModel = transition.to;
        transition = null;
        syncPoolIdle(nowMs);
      }
    }

    // Visibility sweep: only the active model (and the transition pair) show —
    // prevents earlier-loaded GLBs from lingering and overlapping.
    for (const m of models.values()) {
      m.root.visible =
        m === currentModel || (transition !== null && (m === transition.from || m === transition.to));
    }

    if (currentModel && levelChanged) {
      syncPoolIdle(nowMs);
    } else if (
      currentModel &&
      !currentModel.currentIdleName &&
      levelAt(activeLevel).clipPool.length > 0
    ) {
      syncPoolIdle(nowMs);
    }
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(nowMs: number) {
    if (destroyed) return;
    const input = getInput();
    const t = (nowMs - startTime) / 1000;
    const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
    lastMs = nowMs;

    // Synthetic fallback keeps the scene breathing without a live mic feed.
    const feats = input.audio ?? {
      bass: 0.3 + 0.3 * Math.sin(t * 2.5),
      mid: 0.3 + 0.2 * Math.sin(t * 3.1),
      treble: 0.2 + 0.2 * Math.cos(t * 5.0),
      energy: 0.3 + 0.2 * Math.sin(t * 1.5),
    };
    lastFeats = feats;

    // Long average + auto-normalization of overall energy (for the avg readout
    // and auto mode). energyMax decays slowly so it adapts to mic volume.
    avgEnergy += (feats.energy - avgEnergy) * (1 - Math.exp(-dt / 1.5));
    energyMax = Math.max(feats.energy, energyMax * 0.9995);
    normEnergy = clamp01((avgEnergy - autoSilenceFloor) / Math.max(0.001, energyMax - autoSilenceFloor));

    // Auto mode: the song's average energy picks the level, with a silence gate,
    // hysteresis (a clear move past the midpoint) and a minimum dwell time.
    if (energyMode === 'auto') {
      if (avgEnergy >= autoSilenceFloor) {
        const targetFloat = normEnergy * MAX_ENERGY;
        const target = Math.round(targetFloat);
        if (
          target !== autoLevel &&
          Math.abs(targetFloat - autoLevel) > 0.6 &&
          nowMs - lastAutoChangeMs >= autoDwellMs
        ) {
          autoLevel = target;
          lastAutoChangeMs = nowMs;
        }
      }
      energy = autoLevel;
    }

    energySmooth += (energy - energySmooth) * 0.05;
    syncActiveModel(nowMs);

    // Threshold action triggers: rising edge + cooldown, with re-arm hysteresis.
    for (let i = 0; i < actionTriggers.length; i++) {
      const tr = actionTriggers[i]!;
      if (!tr.enabled) continue;
      const st = triggerState[i] ?? (triggerState[i] = { lastFireMs: 0, armed: true });
      const v = clamp01(feats[tr.source]);
      if (st.armed && v >= tr.threshold && nowMs - st.lastFireMs >= tr.cooldownMs) {
        if (tr.actionId) playActionById(tr.actionId);
        st.lastFireMs = nowMs;
        st.armed = false;
      } else if (!st.armed && v < tr.threshold - 0.08) {
        st.armed = true;
      }
    }

    const lo = Math.max(0, Math.min(MAX_ENERGY, Math.floor(energySmooth)));
    const hi = Math.min(MAX_ENERGY, lo + 1);
    const frac = energySmooth - lo;
    const lvLo = levelAt(lo);
    const lvHi = levelAt(hi);
    const eNorm = energySmooth / MAX_ENERGY;

    // Accumulate enabled audio bindings into per-target contributions.
    let scaleAdd = 0;
    let emissiveAdd = 0;
    let hueAdd = 0;
    let rotVel = 0;
    let speedAdd = 0;
    let camFovAdd = 0;
    let camDollyAdd = 0;
    let camShakeAdd = 0;
    for (let i = 0; i < audioBindings.length; i++) {
      const b = audioBindings[i]!;
      if (!b.enabled) continue;
      const raw = clamp01(feats[b.source]);
      const k = 1 - Math.min(0.99, Math.max(0, b.smoothing));
      bindingState[i] = (bindingState[i] ?? 0) + (raw - (bindingState[i] ?? 0)) * k;
      const v = bindingState[i]! * b.amount;
      switch (b.target) {
        case 'scale': scaleAdd += v; break;
        case 'emissive': emissiveAdd += v; break;
        case 'bgHue': hueAdd += v; break;
        case 'rotationY': rotVel += v; break;
        case 'animationSpeed': speedAdd += v; break;
        case 'camFov': camFovAdd += v; break;
        case 'camDolly': camDollyAdd += v; break;
        case 'camShake': camShakeAdd += v; break;
      }
    }

    // Reactivity applies to the model currently coming into view.
    const reactive = transition ? transition.to : currentModel;
    if (reactive) {
      reactive.root.scale.setScalar(1 + scaleAdd);
      reactive.root.rotation.y += rotVel * dt;
      if (reactive.idleAction) reactive.idleAction.timeScale = 0.8 + eNorm * 1.4 + speedAdd;

      const palette = input.palette;
      paletteTargets.forEach((matName, i) => {
        const entry = reactive.materials.find((m) => m.name === matName);
        const mat = entry?.mat as THREE.MeshStandardMaterial | undefined;
        if (!mat) return;
        const color = hexColor(palette[i % Math.max(1, palette.length)], 0x00e3ff);
        if (mat.color instanceof THREE.Color) mat.color.copy(color);
        if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
          mat.emissive.copy(color);
          mat.emissiveIntensity = 0.6 + emissiveAdd;
        }
      });
    }

    // Background + ambient tint from the interpolated level HSL (audio shifts hue).
    if (!useHdrBackground || !envTexture) {
      let h: number;
      let s: number;
      let l: number;
      if (bgOverride) {
        h = (bgOverride.h + hueAdd) % 1;
        s = bgOverride.s;
        l = bgOverride.l;
      } else {
        h = (lerp(lvLo.hsl.h, lvHi.hsl.h, frac) + hueAdd) % 1;
        s = lerp(lvLo.hsl.s, lvHi.hsl.s, frac);
        l = lerp(lvLo.hsl.l, lvHi.hsl.l, frac);
      }
      bgBase.setHSL((h + 1) % 1, s, l);
      (scene.background as THREE.Color).copy(bgBase);
      scene.fog?.color.copy(bgBase);
      // Global tint: ambient leans to the level hue at a brighter lightness.
      const tintH = bgOverride ? bgOverride.h : lerp(lvLo.hsl.h, lvHi.hsl.h, frac);
      const tintS = bgOverride ? bgOverride.s : lerp(lvLo.hsl.s, lvHi.hsl.s, frac);
      const tintL = bgOverride ? bgOverride.l : lerp(lvLo.hsl.l, lvHi.hsl.l, frac);
      tintColor.setHSL((tintH + 1) % 1, tintS, Math.min(0.7, tintL + 0.5));
      ambient.color.copy(tintColor);
    } else {
      ambient.color.setRGB(1, 1, 1);
    }

    const levelLight = lerpLight(lvLo.light, lvHi.light, frac);
    const lightHsl = lightOverride?.hsl ?? levelLight.hsl;
    const lightIntensity = lightOverride?.intensity ?? levelLight.intensity;
    keyLightColor.setHSL(lightHsl.h, lightHsl.s, lightHsl.l);
    key.color.copy(keyLightColor);
    key.intensity = lightIntensity;
    key.position.set(levelLight.direction[0], levelLight.direction[1], levelLight.direction[2]);

    for (const model of models.values()) model.mixer?.update(dt);

    // Camera: in 'driven' the engine owns it — interpolate the per-level framing
    // and layer audio reactivity (fov breathe, dolly push, shake) on top. In
    // 'free' OrbitControls drive it (authoring / inspection).
    if (cameraMode === 'driven') {
      controls.enabled = false;
      let baseCam: CameraConfig;
      if (camOverride) {
        const t =
          camOverride.durationMs <= 0
            ? 1
            : clamp01((nowMs - camOverride.start) / camOverride.durationMs);
        baseCam = lerpCamera(camOverride.from, camOverride.to, t);
      } else {
        baseCam = lerpCamera(effectiveCamera(lo), effectiveCamera(hi), frac);
      }
      camTmpPos.set(baseCam.position[0], baseCam.position[1], baseCam.position[2]);
      camTmpTgt.set(baseCam.target[0], baseCam.target[1], baseCam.target[2]);
      camDir.subVectors(camTmpTgt, camTmpPos).normalize();
      camTmpPos.addScaledVector(camDir, camDollyAdd);
      if (camShakeAdd > 0) {
        camTmpPos.x += (Math.random() - 0.5) * camShakeAdd;
        camTmpPos.y += (Math.random() - 0.5) * camShakeAdd;
      }
      camera.position.copy(camTmpPos);
      camera.fov = Math.min(150, Math.max(5, baseCam.fov + camFovAdd));
      camera.lookAt(camTmpTgt);
      camera.updateProjectionMatrix();
    } else {
      controls.enabled = true;
      controls.update();
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(render);
  }

  resize();
  rafId = requestAnimationFrame(render);

  return {
    loadGlbForLevel,
    loadHdr,
    clearHdr,
    setPaletteTargets: (names) => {
      paletteTargets = names;
    },
    setAudioBindings: (next) => {
      audioBindings = next;
      bindingState = next.map((_, i) => bindingState[i] ?? 0);
    },
    setEnergyLevels: (next) => {
      if (next.length > 0) levels = next;
    },
    setTransitionMode: (mode) => {
      transitionMode = mode;
    },
    setEnergy: (level) => {
      energy = Math.max(0, Math.min(MAX_ENERGY, level));
    },
    setEnergyMode: (mode) => {
      energyMode = mode;
      if (mode === 'auto') {
        autoLevel = Math.round(energySmooth);
        lastAutoChangeMs = performance.now();
      }
    },
    setAutoConfig: (cfg) => {
      autoDwellMs = cfg.dwellMs;
      autoSilenceFloor = cfg.silenceFloor;
    },
    setActionTriggers: (next) => {
      actionTriggers = next;
      triggerState = next.map((_, i) => triggerState[i] ?? { lastFireMs: 0, armed: true });
    },
    setExposure: (value) => {
      renderer.toneMappingExposure = value;
    },
    setUseHdrBackground: (use) => {
      useHdrBackground = use;
      if (use && envTexture) scene.background = envTexture;
    },
    getGlbCamera: (level) => modelForLevel(level)?.glbCamera ?? null,
    getAudioDebug: () => {
      const now = performance.now();
      return {
        feats: lastFeats,
        bindings: bindingState.slice(),
        avgEnergy: normEnergy,
        autoLevel,
        triggersFired: actionTriggers.map((_, i) => now - (triggerState[i]?.lastFireMs ?? -1e9) < 150),
      };
    },
    setCameraMode: (mode) => {
      cameraMode = mode;
    },
    captureCamera: () => ({
      position: [
        +camera.position.x.toFixed(3),
        +camera.position.y.toFixed(3),
        +camera.position.z.toFixed(3),
      ],
      target: [
        +controls.target.x.toFixed(3),
        +controls.target.y.toFixed(3),
        +controls.target.z.toFixed(3),
      ],
      fov: +camera.fov.toFixed(1),
    }),
    applyCameraView: (cam) => {
      camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
      controls.target.set(cam.target[0], cam.target[1], cam.target[2]);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      controls.update();
    },
    previewFov: (fov) => {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    },
    playAction,
    setActions: (next) => {
      actions = next;
    },
    playActionById,
    setLevelLight: (level, light) => {
      if (level < 0 || level >= levels.length) return;
      levels = levels.map((lv, i) => (i === level ? { ...lv, light } : lv));
    },
    lockCurrentClip: () => {
      poolLocked = !poolLocked;
    },
    skipClip: () => {
      advancePoolClip(performance.now());
    },
    readConfig: (partial) => ({
      schemaVersion: 2 as const,
      paletteTargets: partial.paletteTargets,
      energyLevels: partial.energyLevels,
      actions: partial.actions,
      audioBindings: partial.audioBindings,
      transition: partial.transition,
      energyMode: partial.energyMode,
      autoConfig: partial.autoConfig,
      actionTriggers: partial.actionTriggers,
      exposure: +renderer.toneMappingExposure.toFixed(2),
      hdrName: partial.hdrName,
      useHdrBackground,
    }),
    resize,
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      for (const model of models.values()) disposeModel(model);
      models.clear();
      controls.dispose();
      dracoLoader.dispose();
      pmrem.dispose();
      if (envTexture) envTexture.dispose();
      renderer.dispose();
    },
  };
}
