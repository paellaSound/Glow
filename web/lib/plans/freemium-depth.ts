import type { GifSearchMode, PlanEntitlements, VisualsMode } from '@/lib/glow/types';

export const UNLIMITED_EMIT_SLOTS = 999;

export function isUnlimitedEmitSlots(slots: number): boolean {
  return slots >= UNLIMITED_EMIT_SLOTS;
}

export function canEmitVisualsMode(
  entitlements: Pick<PlanEntitlements, 'visualsEmitSlotsPerMode'>,
  emittedCounts: Partial<Record<VisualsMode, number>>,
  mode: VisualsMode
): { allowed: boolean; used: number; limit: number } {
  const limit = entitlements.visualsEmitSlotsPerMode ?? UNLIMITED_EMIT_SLOTS;
  if (isUnlimitedEmitSlots(limit)) {
    return { allowed: true, used: 0, limit };
  }
  const used = emittedCounts[mode] ?? 0;
  return { allowed: used < limit, used, limit };
}

export function hasFullGifSearch(mode: GifSearchMode): boolean {
  return mode === 'full';
}

export function isLiveCallProduction(entitlements: Pick<PlanEntitlements, 'webrtcLiveCall'>): boolean {
  return Boolean(entitlements.webrtcLiveCall);
}

export function showLiveCallTestDesk(
  entitlements: Pick<PlanEntitlements, 'webrtcLiveCall' | 'liveCallTestModeOnly'>
): boolean {
  return Boolean(entitlements.liveCallTestModeOnly && !entitlements.webrtcLiveCall);
}
