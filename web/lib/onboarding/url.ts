/** URL query param to force or reset onboarding (debug / replay). */
export const ONBOARDING_URL_PARAM = 'onboarding';

export type OnboardingUrlIntent =
  | { type: 'none' }
  | { type: 'show' }
  | { type: 'inspect' }
  | { type: 'reset-local' };

const FORCE_SHOW_VALUES = new Set(['1', 'true', 'first-party', 'show', 'debug', 'force']);

/**
 * Parse ?onboarding= from the URL.
 *
 * - `?onboarding=inspect` → debug HUD only (production state, no force)
 * - `?onboarding=1` | `first-party` | `show` | `debug` | `force` → force checklist + debug HUD
 * - `?onboarding=reset-local` → clear localStorage fallback keys
 */
export function parseOnboardingUrl(searchParams: URLSearchParams): OnboardingUrlIntent {
  const raw = searchParams.get(ONBOARDING_URL_PARAM)?.trim().toLowerCase();
  if (!raw) return { type: 'none' };
  if (raw === 'inspect') return { type: 'inspect' };
  if (FORCE_SHOW_VALUES.has(raw)) return { type: 'show' };
  if (raw === 'reset-local') return { type: 'reset-local' };
  return { type: 'none' };
}

export function shouldShowOnboardingInspectHud(searchParams: URLSearchParams): boolean {
  const intent = parseOnboardingUrl(searchParams);
  return intent.type === 'inspect' || intent.type === 'show' || intent.type === 'reset-local';
}

export function buildOnboardingControlUrl(
  roomCode: string,
  mode: 'show' | 'inspect' | 'reset-local' = 'show'
): string {
  const code = roomCode.toLowerCase();
  const param =
    mode === 'show' ? 'first-party' : mode === 'inspect' ? 'inspect' : 'reset-local';
  return `/room/${code}/control?${ONBOARDING_URL_PARAM}=${param}`;
}
