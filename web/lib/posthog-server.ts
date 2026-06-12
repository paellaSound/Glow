import { PostHog } from 'posthog-node';
import { getPostHogHost, getPostHogToken, isPostHogEnabled } from '@/lib/posthog-config';

export type PostHogLike = Pick<
  PostHog,
  'capture' | 'identify' | 'groupIdentify' | 'captureException' | 'shutdown'
>;

const noopClient: PostHogLike = {
  capture: () => undefined,
  identify: () => undefined,
  groupIdentify: () => undefined,
  captureException: () => undefined,
  shutdown: async () => undefined,
};

let singleton: PostHog | null = null;

export function getPostHogClient(): PostHogLike {
  if (!isPostHogEnabled()) {
    return noopClient;
  }

  const token = getPostHogToken();
  if (!token) {
    return noopClient;
  }

  if (!singleton) {
    singleton = new PostHog(token, {
      host: getPostHogHost(),
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return singleton;
}
