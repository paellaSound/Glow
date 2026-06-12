import { PostHog } from 'posthog-node';

export function getPostHogClient() {
  const client = new PostHog(process.env.NEXT_POSTHOG_PROJECT_TOKEN!, {
    host: process.env.NEXT_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}
