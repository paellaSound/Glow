import type { AudioBinding, AudioSource, AudioTarget, CameraConfig } from 'glow-visuals-3d';

export const DEFAULT_PALETTE = ['#00e3ff', '#ff00c8', '#ffb300', '#7c4dff'];
export const TEST_GLB_URL = '/visuals3d/goku.glb';

export const AUDIO_SOURCES: AudioSource[] = ['bass', 'mid', 'treble', 'energy'];
export const AUDIO_TARGETS: { id: AudioTarget; label: string }[] = [
  { id: 'scale', label: 'scale / pulse' },
  { id: 'emissive', label: 'glow (emissive)' },
  { id: 'bgHue', label: 'background hue' },
  { id: 'rotationY', label: 'rotation' },
  { id: 'animationSpeed', label: 'anim speed' },
  { id: 'camFov', label: 'camera FOV' },
  { id: 'camDolly', label: 'camera dolly' },
  { id: 'camShake', label: 'camera shake' },
];

export const DEFAULT_CAMERA: CameraConfig = { position: [3.5, 2, 5], target: [0, 1, 0], fov: 50 };

export const ZIP_README = `Glow 3D scene bundle
====================
scene.json            scene config (energy curve, audio bindings, cameras, palette)
glb/level-N.glb       the GLB for energy level N (a level with glb=null inherits the nearest)
environment.hdr       optional HDR environment

Each energyLevels[N].glb in scene.json points to its file here. Load scene.json,
then load each level's GLB + the HDR, and feed the config to the 3D engine
(mountSandboxScene) — same as /dev/visuals3d/play does from IndexedDB.
`;

export const FOV_PRESETS: { label: string; fov: number }[] = [
  { label: 'fisheye', fov: 100 },
  { label: 'wide', fov: 65 },
  { label: 'normal', fov: 50 },
  { label: '50mm', fov: 28 },
  { label: '85mm', fov: 16 },
];

export const DEFAULT_BINDINGS: AudioBinding[] = [
  { source: 'bass', target: 'scale', amount: 0.15, smoothing: 0.5, enabled: true },
  { source: 'bass', target: 'emissive', amount: 1.0, smoothing: 0.4, enabled: true },
  { source: 'treble', target: 'animationSpeed', amount: 1.0, smoothing: 0.6, enabled: true },
];

export type Workspace = 'layout' | 'niveles' | 'acciones' | 'audio' | 'export';
export type OutlinerSelection =
  | { kind: 'level'; level: number }
  | { kind: 'actions' }
  | { kind: 'scene' };
export type LevelTab = 'nivel' | 'camera' | 'light' | 'material';

export const WORKSPACES: { id: Workspace; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'niveles', label: 'Levels' },
  { id: 'acciones', label: 'Actions' },
  { id: 'audio', label: 'Audio' },
  { id: 'export', label: 'Export' },
];
