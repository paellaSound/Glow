import posthog from 'posthog-js';
import { isPostHogEnabled } from '@/lib/posthog-config';

export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!isPostHogEnabled()) return;
  posthog.capture(event, properties);
}
