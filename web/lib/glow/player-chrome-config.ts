import type { PlanEntitlements } from '@/lib/glow/types';

/** Percent-based rect within the player viewport (0–100). */
export type PlayerChromeLayerRect = {
  x: number;
  y: number;
  width: number;
  height?: number;
  opacity?: number;
};

export type PlayerChromeUserLogoLayer = PlayerChromeLayerRect & {
  visible: boolean;
};

/** Extensible layer map — only userLogo is editable in v1. */
export type PlayerChromeLayers = {
  userLogo?: PlayerChromeUserLogoLayer;
};

export type PlayerMenuItemId =
  | 'share-link'
  | 'qr-code'
  | 'fullscreen'
  | 'more-options'
  | 'flash-effects'
  | 'exit-rave';

export type PlayerMenuConfig = {
  /** Hidden toolbar / HUD sheet items. Omitted ids are visible. */
  hiddenItems?: PlayerMenuItemId[];
};

export const PLAYER_MENU_ITEMS: ReadonlyArray<{
  id: PlayerMenuItemId;
  label: string;
  description: string;
  group: 'toolbar' | 'sheet';
}> = [
  {
    id: 'share-link',
    label: 'Copy link',
    description: 'Toolbar — copy join URL to clipboard',
    group: 'toolbar',
  },
  {
    id: 'qr-code',
    label: 'QR code',
    description: 'Toolbar — open join QR modal',
    group: 'toolbar',
  },
  {
    id: 'fullscreen',
    label: 'Fullscreen',
    description: 'Toolbar — enter or exit fullscreen',
    group: 'toolbar',
  },
  {
    id: 'flash-effects',
    label: 'Flash effects',
    description: 'HUD sheet — camera LED opt-in',
    group: 'sheet',
  },
  {
    id: 'exit-rave',
    label: 'Exit rave',
    description: 'HUD sheet — leave the room (requires More menu)',
    group: 'sheet',
  },
];

export type PlayerChromeConfig = {
  /** Admin-only. When false, reactions bar is hidden on player devices. Default: true. */
  showReactionsToolbar?: boolean;
  /** Hold-to-flash button bottom-right. Default: true. */
  showFlashButton?: boolean;
  /** Sync delay readout in status bar, e.g. "(85ms)". Default: true. */
  showSyncDelay?: boolean;
  playerMenu?: PlayerMenuConfig;
  layers?: PlayerChromeLayers;
};

export const DEFAULT_USER_LOGO_LAYER: PlayerChromeUserLogoLayer = {
  visible: true,
  x: 72,
  y: 8,
  width: 22,
  opacity: 0.92,
};

export const FREE_PLAN_WATERMARK_TEXT = 'glowtherave.com';

export function parsePlayerChromeConfig(raw: unknown): PlayerChromeConfig {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const layersRaw = source.layers;
  const layers: PlayerChromeLayers = {};

  if (layersRaw && typeof layersRaw === 'object') {
    const userLogoRaw = (layersRaw as Record<string, unknown>).userLogo;
    if (userLogoRaw && typeof userLogoRaw === 'object') {
      const u = userLogoRaw as Record<string, unknown>;
      layers.userLogo = {
        visible: u.visible !== false,
        x: clampPercent(Number(u.x), DEFAULT_USER_LOGO_LAYER.x),
        y: clampPercent(Number(u.y), DEFAULT_USER_LOGO_LAYER.y),
        width: clampPercent(Number(u.width), DEFAULT_USER_LOGO_LAYER.width, 8, 60),
        height:
          u.height === undefined || u.height === null
            ? undefined
            : clampPercent(Number(u.height), 12, 4, 80),
        opacity: clampOpacity(Number(u.opacity)),
      };
    }
  }

  const menuRaw = source.playerMenu;
  let playerMenu: PlayerMenuConfig | undefined;
  if (menuRaw && typeof menuRaw === 'object') {
    const hiddenRaw = (menuRaw as Record<string, unknown>).hiddenItems;
    if (Array.isArray(hiddenRaw)) {
      const allowed = new Set<PlayerMenuItemId>(
        PLAYER_MENU_ITEMS.map((item) => item.id)
      );
      const hiddenItems = hiddenRaw.filter(
        (id): id is PlayerMenuItemId => typeof id === 'string' && allowed.has(id as PlayerMenuItemId)
      );
      if (hiddenItems.length) playerMenu = { hiddenItems };
    }
  }

  return {
    showReactionsToolbar:
      source.showReactionsToolbar === undefined ? undefined : source.showReactionsToolbar !== false,
    showFlashButton:
      source.showFlashButton === undefined ? undefined : source.showFlashButton !== false,
    showSyncDelay:
      source.showSyncDelay === undefined ? undefined : source.showSyncDelay !== false,
    playerMenu,
    layers: Object.keys(layers).length ? layers : undefined,
  };
}

export function getUserLogoLayer(config: PlayerChromeConfig): PlayerChromeUserLogoLayer {
  return { ...DEFAULT_USER_LOGO_LAYER, ...config.layers?.userLogo };
}

export function mergePlayerChromeConfig(
  base: PlayerChromeConfig,
  patch: Partial<PlayerChromeConfig>
): PlayerChromeConfig {
  return {
    showReactionsToolbar:
      patch.showReactionsToolbar !== undefined
        ? patch.showReactionsToolbar
        : base.showReactionsToolbar,
    showFlashButton:
      patch.showFlashButton !== undefined ? patch.showFlashButton : base.showFlashButton,
    showSyncDelay: patch.showSyncDelay !== undefined ? patch.showSyncDelay : base.showSyncDelay,
    playerMenu: patch.playerMenu
      ? {
          hiddenItems: patch.playerMenu.hiddenItems ?? base.playerMenu?.hiddenItems,
        }
      : base.playerMenu,
    layers: {
      ...base.layers,
      ...patch.layers,
      userLogo: patch.layers?.userLogo
        ? { ...getUserLogoLayer(base), ...patch.layers.userLogo }
        : base.layers?.userLogo ?? getUserLogoLayer(base),
    },
  };
}

export function playerChromeConfigsEqual(a: PlayerChromeConfig, b: PlayerChromeConfig): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

function normalizeForCompare(config: PlayerChromeConfig) {
  const logo = getUserLogoLayer(config);
  return {
    showReactionsToolbar: config.showReactionsToolbar !== false,
    showFlashButton: config.showFlashButton !== false,
    showSyncDelay: config.showSyncDelay !== false,
    hiddenMenuItems: [...(config.playerMenu?.hiddenItems ?? [])].sort(),
    userLogo: logo,
  };
}

export function shouldShowFlashButton(config: PlayerChromeConfig): boolean {
  return config.showFlashButton !== false;
}

export function shouldShowSyncDelay(config: PlayerChromeConfig): boolean {
  return config.showSyncDelay !== false;
}

export function isPlayerMenuItemVisible(
  config: PlayerChromeConfig,
  itemId: PlayerMenuItemId
): boolean {
  return !config.playerMenu?.hiddenItems?.includes(itemId);
}

export function setPlayerMenuItemVisible(
  config: PlayerChromeConfig,
  itemId: PlayerMenuItemId,
  visible: boolean
): PlayerChromeConfig {
  const hidden = new Set(config.playerMenu?.hiddenItems ?? []);
  if (visible) hidden.delete(itemId);
  else hidden.add(itemId);
  const hiddenItems = [...hidden];
  return {
    ...config,
    playerMenu: hiddenItems.length ? { hiddenItems } : undefined,
  };
}

export function shouldShowReactionsToolbar(
  config: PlayerChromeConfig,
  entitlements: Pick<PlanEntitlements, 'audienceReactions'>
): boolean {
  if (!entitlements.audienceReactions) return false;
  return config.showReactionsToolbar !== false;
}

export function shouldShowPlayerWatermark(
  entitlements: Pick<PlanEntitlements, 'removeWatermark' | 'customRigLogo'>,
  logoUrl: string | null,
  logoVisible: boolean
): boolean {
  if (entitlements.removeWatermark) return false;
  if (entitlements.customRigLogo && logoUrl && logoVisible) return false;
  return true;
}

export function shouldShowUserLogo(
  entitlements: Pick<PlanEntitlements, 'customRigLogo'>,
  logoUrl: string | null,
  layer: PlayerChromeUserLogoLayer
): boolean {
  return Boolean(entitlements.customRigLogo && logoUrl && layer.visible);
}

export function rigLogoPublicUrl(logoAssetPath: string | null | undefined): string | null {
  if (!logoAssetPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!base) return null;
  return `${base}/storage/v1/object/public/rig-logos/${logoAssetPath}`;
}

function clampPercent(value: number, fallback: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampOpacity(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}
