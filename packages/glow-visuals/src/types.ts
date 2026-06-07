// Types shared between the glow-visuals package and consumers (web, realtime).
// AudioFeatures is intentionally duplicated here to keep this package free of
// runtime dependencies on glow-presets.

export type PlanTier = 'free' | 'plus_25' | 'plus_50' | 'pro';

export type AudioFeatures = {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
};

/** All registered visual art identifiers. */
export type VisualArtId = 'glow-branded' | 'pulse-grid' | 'audio-shader';

/**
 * The input snapshot passed to a visual art each animation frame.
 * All fields except `timeMs` are optional so arts degrade gracefully.
 */
export type VisualArtInput = {
  /** Monotonic clock, milliseconds. */
  timeMs: number;
  /** 1–4 hex color strings from the active palette (e.g. ['#ff00cc', '#00eeff']). */
  palette: string[];
  /** Real-time audio analysis. Present only when audio stream is active. */
  audio?: AudioFeatures;
  /** Optional logo overlay config. null = hide logo. */
  logo?: {
    url: string;
    opacity: number;
    /** 5 named positions — matches RigConsoleConfig.logoConfig.position */
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** CSS-keyframe animation applied to the logo overlay. */
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  } | null;
  /** Art-specific freeform parameters (sliders, toggles, etc.). */
  params?: Record<string, number | string | boolean>;
  /** Room code — used by glow-branded art to generate QR / share URL. */
  roomCode?: string;
};

/**
 * Returned by `VisualArtDefinition.mount()`. The caller holds this ref
 * for the lifetime of the art and calls `destroy()` before swapping.
 */
export type VisualArtController = {
  /**
   * Push a new input snapshot. Arts may call this every frame or pull via
   * the getter passed to `mount()` — whichever pattern the art prefers.
   */
  setInput: (input: VisualArtInput) => void;
  /** Called on container resize so the art can update its viewport. */
  resize: () => void;
  /** Tear down WebGL context / cancel rAF / remove event listeners. */
  destroy: () => void;
};

/**
 * Static descriptor for a visual art. Stored in `VISUAL_ART_REGISTRY`.
 */
export type VisualArtDefinition = {
  id: VisualArtId;
  label: string;
  description?: string;
  /** Minimum plan tier required to select this art from the control desk. */
  minTier: PlanTier;
  /**
   * Mount the art into `canvas`. Return a controller so the caller can
   * update input and tear down later.
   *
   * @param canvas  The target HTMLCanvasElement (already appended to DOM).
   * @param getInput  Getter for the latest VisualArtInput — arts may call
   *                  this each frame instead of waiting for `setInput`.
   */
  mount: (canvas: HTMLCanvasElement, getInput: () => VisualArtInput) => VisualArtController;
};

export type ReactionOverlayConfig = {
  baseSizePx: number;
  maxSizePx: number;
  showNickname: boolean;
  riseDurationMs: number;
  maxConcurrent: number;
};
