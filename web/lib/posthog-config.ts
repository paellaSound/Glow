/** Shared PostHog enablement — safe on server and client (NEXT_PUBLIC_*). */

function readEnabledFlag(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_ENABLED ?? process.env.POSTHOG_ENABLED;
}

export function getPostHogToken(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ??
    process.env.NEXT_POSTHOG_PROJECT_TOKEN ??
    process.env.POSTHOG_PROJECT_TOKEN
  );
}

export function getPostHogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    process.env.NEXT_POSTHOG_HOST ??
    process.env.POSTHOG_HOST ??
    'https://eu.i.posthog.com'
  );
}

/**
 * PostHog is off when:
 * - NEXT_PUBLIC_POSTHOG_ENABLED=false
 * - NODE_ENV=development (unless explicitly enabled with =true)
 * - no project token
 */
export function isPostHogEnabled(): boolean {
  const flag = readEnabledFlag();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return Boolean(getPostHogToken());
  if (process.env.NODE_ENV === 'development') return false;
  return Boolean(getPostHogToken());
}
