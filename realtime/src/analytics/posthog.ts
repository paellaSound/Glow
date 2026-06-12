import { PostHog } from 'posthog-node';

function readEnabledFlag(): string | undefined {
  return process.env.POSTHOG_ENABLED ?? process.env.NEXT_PUBLIC_POSTHOG_ENABLED;
}

function getToken(): string | undefined {
  return (
    process.env.POSTHOG_API_KEY ??
    process.env.POSTHOG_PROJECT_TOKEN ??
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  );
}

function getHost(): string {
  return process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
}

export function isRealtimePostHogEnabled(): boolean {
  const flag = readEnabledFlag();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return Boolean(getToken());
  if (process.env.NODE_ENV === 'development') return false;
  return Boolean(getToken());
}

type PostHogLike = Pick<PostHog, 'capture' | 'captureException' | 'shutdown'>;

const noopClient: PostHogLike = {
  capture: () => undefined,
  captureException: () => undefined,
  shutdown: async () => undefined,
};

let singleton: PostHog | null = null;

export function getRealtimePostHog(): PostHogLike {
  if (!isRealtimePostHogEnabled()) {
    return noopClient;
  }

  const token = getToken();
  if (!token) {
    return noopClient;
  }

  if (!singleton) {
    singleton = new PostHog(token, {
      host: getHost(),
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return singleton;
}

type RoomAnalyticsContext = {
  roomCode: string;
  teamId: string;
  ownerUserId: string;
  planCode: string;
};

export function captureRealtimeEvent(
  distinctId: string,
  event: string,
  room: RoomAnalyticsContext,
  properties?: Record<string, unknown>
): void {
  const client = getRealtimePostHog();
  client.capture({
    distinctId,
    event,
    properties: {
      surface: 'realtime',
      room_code: room.roomCode,
      plan_code: room.planCode,
      team_id: room.teamId,
      ...properties,
    },
    groups: { team: room.teamId },
  });
}

export function captureRealtimeException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const client = getRealtimePostHog();
  client.captureException(error, undefined, {
    surface: 'realtime',
    app_version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
    ...context,
  });
}

export async function shutdownRealtimePostHog(): Promise<void> {
  if (singleton) {
    await singleton.shutdown();
    singleton = null;
  }
}
