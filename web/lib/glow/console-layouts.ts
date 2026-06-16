import { parsePlayerChromeConfig, type PlayerChromeConfig } from './player-chrome-config';

/**
 * A named operator console layout. Stored as an array inside the rig's
 * `console_config.layouts`, with `console_config.activeLayoutId` pointing at the
 * active one. The active layout's fields are always mirrored to the top-level
 * `console_config` (hiddenButtons / playSectionOrder / playerChrome) so consumers
 * that read those directly (e.g. /api/rooms/[code]/share-info → /play) keep working
 * without knowing about layouts.
 */
export type ConsoleLayout = {
  id: string;
  name: string;
  hiddenButtons: string[];
  playSectionOrder: string[];
  playerChrome: PlayerChromeConfig;
  /** Hidden Visuals desk section ids (layout-only; not mirrored to top-level console_config). */
  visualsHidden: string[];
  /** Visuals desk section order (layout-only; not mirrored to top-level console_config). */
  visualsOrder: string[];
};

export type ConsoleLayoutsState = {
  layouts: ConsoleLayout[];
  activeLayoutId: string;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeLayout(raw: unknown, index: number): ConsoleLayout {
  const source = (raw ?? {}) as Record<string, unknown>;
  const id = typeof source.id === 'string' && source.id ? source.id : `layout-${index}`;
  const name =
    typeof source.name === 'string' && source.name.trim() ? source.name : `Layout ${index + 1}`;
  return {
    id,
    name,
    hiddenButtons: toStringArray(source.hiddenButtons),
    playSectionOrder: toStringArray(source.playSectionOrder),
    playerChrome: parsePlayerChromeConfig(source.playerChrome),
    visualsHidden: toStringArray(source.visualsHidden),
    visualsOrder: toStringArray(source.visualsOrder),
  };
}

/**
 * Parse layouts from a rig's console_config. Falls back to synthesizing a single
 * "Default" layout from the legacy top-level fields when no layouts array exists.
 */
export function parseConsoleLayouts(
  consoleConfig: Record<string, unknown> | null | undefined
): ConsoleLayoutsState {
  const cfg = (consoleConfig ?? {}) as Record<string, unknown>;
  const rawLayouts = cfg.layouts;

  if (Array.isArray(rawLayouts) && rawLayouts.length > 0) {
    const layouts = rawLayouts.map((layout, index) => normalizeLayout(layout, index));
    const requested = cfg.activeLayoutId;
    const activeLayoutId =
      typeof requested === 'string' && layouts.some((layout) => layout.id === requested)
        ? requested
        : layouts[0]!.id;
    return { layouts, activeLayoutId };
  }

  const fallback: ConsoleLayout = {
    id: 'default',
    name: 'Default',
    hiddenButtons: toStringArray(cfg.hiddenButtons),
    playSectionOrder: toStringArray(cfg.playSectionOrder),
    playerChrome: parsePlayerChromeConfig(cfg.playerChrome),
    visualsHidden: toStringArray(cfg.visualsHidden),
    visualsOrder: toStringArray(cfg.visualsOrder),
  };
  return { layouts: [fallback], activeLayoutId: fallback.id };
}

export function createLayoutId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `layout-${crypto.randomUUID()}`;
  }
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
