import {
  DEFAULT_LIGHT,
  DEFAULT_POOL_PLAYBACK,
  ENERGY_LEVEL_COUNT,
  MAX_ENERGY,
  type EnergyLevelConfig,
  type HSL,
} from 'glow-visuals-3d';
import { DEFAULT_CAMERA } from './constants';

export function ext(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}

export function emptyLevels(): EnergyLevelConfig[] {
  return Array.from({ length: ENERGY_LEVEL_COUNT }, (_, i) => ({
    glb: null,
    hsl: { h: 0.62, s: 0.55, l: 0.04 + (i / MAX_ENERGY) * 0.04 },
    light: DEFAULT_LIGHT,
    clipPool: [],
    poolPlayback: DEFAULT_POOL_PLAYBACK,
    camera: { ...DEFAULT_CAMERA },
    cameraSource: 'engine' as const,
  }));
}

export function normalizeLevel(lv: Partial<EnergyLevelConfig>, i: number): EnergyLevelConfig {
  return {
    glb: lv.glb ?? null,
    hsl: lv.hsl ?? { h: 0.62, s: 0.55, l: 0.04 + (i / MAX_ENERGY) * 0.04 },
    light: lv.light ?? DEFAULT_LIGHT,
    clipPool: lv.clipPool ?? [],
    poolPlayback: lv.poolPlayback ?? DEFAULT_POOL_PLAYBACK,
    camera: lv.camera ?? { ...DEFAULT_CAMERA },
    cameraSource: lv.cameraSource ?? 'engine',
  };
}

export function hslToHex({ h, s, l }: HSL): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (tt: number) => {
      let t = tt;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = f(h + 1 / 3);
    g = f(h);
    b = f(h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToHsl(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

export function allClipsFromInspection(
  levelInspection: (import('glow-visuals-3d').SceneInspection | null)[],
): string[] {
  return Array.from(new Set(levelInspection.flatMap((insp) => insp?.clips ?? [])));
}
