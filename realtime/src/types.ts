export type GifSearchMode = 'featured_page1' | 'full';

export type PlanEntitlements = {
  maxDevices: number;
  maxMatrixCells: number;
  adsEnabled: boolean;
  availablePresets: string[];
  audioReactive: boolean;
  matrixMode: boolean;
  advancedMatrix: boolean;
  customGridSize: boolean;
  maxGridRows: number;
  maxGridCols: number;
  maxRoomDurationMinutes: number;
  manualFallbackMode: boolean;
  priorityReconnectWindowSeconds: number;
  customRigLogo: boolean;
  customQrBranding: boolean;
  gifSearchMode: GifSearchMode;
  // v2 — Visuals surface
  visualsSurface: boolean;
  availableVisualArts: string[];
  maxRigs: number;
  effectLayering: boolean;
  maxPatternSequences: number;
  audienceReactions: boolean;
  customMediaUpload: boolean;
  gifBroadcast: boolean;
  sequencedText: boolean;
  deviceFlashControl: boolean;
  webrtcLiveCall: boolean;
  maxLiveCallDevices: number;
  visualsEmitSlotsPerMode: number;
  liveCallTestModeOnly: boolean;
  pollProductionEnabled: boolean;
};

// ── WebRTC live-call ─────────────────────────────────────────────────────────

export type WebrtcSignal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit };

export type LiveTile = {
  publicId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export type LiveCallPublisherStatus = 'requested' | 'live' | 'declined';

export type LiveCallPublisherState = {
  publicId: string;
  status: LiveCallPublisherStatus;
};

export type LiveCallState = {
  callId: string;
  active: boolean;
  publishers: Map<string, LiveCallPublisherState>;
  tiles: LiveTile[];
  /** Per-publisher timestamp of last surface_reconnect emit (cooldown against spam). */
  surfaceReconnectCooldown?: Map<string, number>;
};

export type LiveCallStatePayload = {
  callId: string;
  active: boolean;
  publishers: LiveCallPublisherState[];
  tiles: LiveTile[];
};

export type PlayerDeviceState = {
  socketId: string;
  publicId: string;
  nickname?: string;
  row?: number;
  col?: number;
  label?: string;
  joinedAt: number;
  lastSeenAt: number;
  lastPingAt?: number;
  latencyMs?: number;
  status: 'online' | 'stale' | 'reconnecting';
  torchCapability?: TorchCapability;
};

export type RigSocial = {
  kind: string;
  label: string | null;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

export type MatrixState = {
  rows: number;
  cols: number;
  cells: Map<string, string>;
};

export type RoomState = {
  code: string;
  sessionId: string;
  teamId: string;
  orchestratorUserId: string;
  ownerUserId: string;
  orchestratorSocketId: string;
  planCode: string;
  status: 'active' | 'orchestrator_missing' | 'closing';
  createdAt: number;
  lastActivityAt: number;
  reconnectDeadlineAt?: number;
  closesAt: number;
  mode: 'live' | 'fallback';
  fallbackSeed?: number;
  matrix: MatrixState;
  entitlements: PlanEntitlements;
  devices: Map<string, PlayerDeviceState>;
  disconnectedPlayers: Map<string, PlayerDeviceState>;
  totalJoinedDevices: number;
  peakDevices: number;
  adsEnabled: boolean;
  visualsState: VisualsState;
  playerVisualState: PlayerVisualState;
  /** Live cue position — advanced by orchestrator:visuals_next_cue */
  cueIndex?: number;
  /** Snapshot of the rig cue list, set on room creation, used for Next/Prev */
  rigCues?: Array<{
    id: string;
    visualArtId: string;
    sortOrder: number;
    params?: Record<string, unknown>;
    transition?: { type: 'cut' | 'fade'; durationMs: number };
    label?: string;
  }>;
  /** Active WebRTC live-call state (mesh publishers → visuals surface) */
  liveCall?: LiveCallState;
  rigName?: string | null;
  rigSocials?: RigSocial[];
  /** Per-mode emit counts toward visuals_emit_slots_per_mode (freemium depth). */
  visualsEmittedCounts?: Map<VisualsMode, number>;
};

export type VisualsMode = 'standard' | 'youtube' | 'custom-video' | '3d' | 'pptt';

export type YoutubeTransitionEffect = 'glitch' | 'dip-black' | 'pixel-melt';

export type YoutubeQueueItem =
  | { kind: 'video'; videoId: string; title?: string; thumbnail?: string }
  | { kind: 'transition'; effect: YoutubeTransitionEffect };

export type VisualsState = {
  /** Which rendering pipeline the surface uses. Defaults to 'standard' (2D arts). */
  mode: VisualsMode;
  artId: string;
  params?: Record<string, unknown>;
  palette: string[];
  logo?: {
    url: string;
    opacity: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  } | null;
  transition?: 'cut' | 'fade';
  qrConfig?: {
    enabled: boolean;
    intervalSeconds: number;
    durationSeconds: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'small' | 'medium' | 'large';
  } | null;
  displayName?: string;
  /** Where the show name renders. When it matches the logo position they stack. */
  displayNamePosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  text?: {
    text: string;
    mode: 'marquee' | 'word_by_word' | 'spread_grid';
    speed: number;
    colorHex?: string;
    fontSize?: number;
    loop: boolean;
  } | null;
  /** YouTube mode state — null until a video is loaded. */
  youtube?: {
    videoId: string | null;
    queue: YoutubeQueueItem[];
    /** Index into `queue` of the playing video item. */
    queueIndex: number;
    playing: boolean;
    muted: boolean;
    /** 0–100 */
    volume: number;
    /** One-shot seek target in seconds — surface consumes it. */
    seekToSec?: number | null;
    /** Transition effect the surface plays while the next video loads (one-shot). */
    pendingTransition?: YoutubeTransitionEffect | null;
    updatedAt: number;
  } | null;
  /** 3D mode state — persisted energy level so reloads restore it. */
  threeD?: {
    assetId: 'energy-orb';
    /** 0–5 */
    energy: number;
    updatedAt: number;
  } | null;
  version: number;
  updatedAt: number;
};

export type PlayerVisualState = {
  kind: 'color' | 'preset' | 'distribution' | 'fallback' | 'idle';
  payload: any;
  version: number;
  updatedAt: number;
};

export type RoomStatePayload = {
  code: string;
  sessionId: string;
  status: RoomState['status'];
  mode: RoomState['mode'];
  matrix: { rows: number; cols: number; occupied: Array<{ row: number; col: number; label: string; publicId: string; nickname?: string; latencyMs?: number; status: string }> };
  devices: Array<Omit<PlayerDeviceState, 'socketId'>>;
  entitlements: PlanEntitlements;
  adsEnabled: boolean;
  serverTime: number;
  rigName?: string | null;
  rigSocials?: RigSocial[];
};

export type TorchCapability = {
  supported: boolean;
  enabled: boolean;
};

export type TorchCommand =
  | { action: 'off' }
  | { action: 'hold'; mode: 'pulse' }
  | { action: 'hold'; mode: 'strobe'; onMs: number; offMs: number }
  | { action: 'on' }
  | { action: 'pulse'; durationMs: number }
  | { action: 'pattern'; onMs: number; offMs: number; cycles: number };

export type DeviceTorchEvent = {
  command: TorchCommand;
  targetTimestamp: number;
};

export type DeviceTarget =
  | { kind: 'all' }
  | { kind: 'devices'; publicIds: string[] }
  | { kind: 'matrix_range'; fromRow: number; toRow: number; fromCol: number; toCol: number }
  | { kind: 'fraction'; from: number; to: number };

export type VisualMediaEvent = {
  kind: 'image' | 'gif' | 'text' | 'clear';
  url?: string;
  text?: string;
  mode?: 'marquee' | 'word_by_word' | 'spread_grid';
  speed?: number;
  colorHex?: string;
  loop?: boolean;
  fontSize?: number;
  fit?: 'cover' | 'contain';
  durationMs?: number;
  timestamp: number;
};
