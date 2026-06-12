import type { PlanEntitlements, VisualsMode } from './types.js';

export const UNLIMITED_EMIT_SLOTS = 999;

export function isUnlimitedEmitSlots(slots: number): boolean {
  return slots >= UNLIMITED_EMIT_SLOTS;
}

export function canEmitVisualsMode(
  entitlements: Pick<PlanEntitlements, 'visualsEmitSlotsPerMode'>,
  emittedCounts: Map<VisualsMode, number> | undefined,
  mode: VisualsMode
): { allowed: boolean; reason?: string } {
  const limit = entitlements.visualsEmitSlotsPerMode ?? UNLIMITED_EMIT_SLOTS;
  if (isUnlimitedEmitSlots(limit)) {
    return { allowed: true };
  }
  const used = emittedCounts?.get(mode) ?? 0;
  if (used >= limit) {
    return { allowed: false, reason: 'visuals_emit_limit' };
  }
  return { allowed: true };
}

export function recordVisualsEmit(
  emittedCounts: Map<VisualsMode, number> | undefined,
  mode: VisualsMode
): Map<VisualsMode, number> {
  const map = emittedCounts ?? new Map<VisualsMode, number>();
  map.set(mode, (map.get(mode) ?? 0) + 1);
  return map;
}
