// Shared types for glow-visuals-3d. AudioFeatures intentionally duplicated
// (same convention as glow-visuals) to keep the package dependency-free.

export type AudioFeatures = {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
};

/** Per-frame input pulled by the 3D scene via the getter passed to mount. */
export type Visuals3DInput = {
  timeMs: number;
  /** 1–4 hex color strings from the active palette. */
  palette: string[];
  audio?: AudioFeatures;
};

export type OrbAction = 'shockwave' | 'burst';

export type Visuals3DController = {
  /** Discrete energy level 0–5 — drives scale/speed/emissive/height/background. */
  setEnergy: (level: number) => void;
  /** Play a one-shot action animation, then return to idle. */
  triggerAction: (action: OrbAction) => void;
  resize: () => void;
  destroy: () => void;
};
