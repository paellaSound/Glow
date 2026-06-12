import { getPostHogClient, type PostHogLike } from '@/lib/posthog-server';

export type OrchestratorTraits = {
  team_id: string;
  plan_code: string;
  subscription_status: string;
};

export function identifyOrchestrator(
  client: PostHogLike,
  userId: string,
  traits: OrchestratorTraits
): void {
  client.identify({
    distinctId: userId,
    properties: traits,
  });
  client.groupIdentify({
    groupType: 'team',
    groupKey: traits.team_id,
    properties: {
      plan_code: traits.plan_code,
      subscription_status: traits.subscription_status,
    },
  });
}

export async function identifyOrchestratorFromTeam(
  userId: string,
  team: {
    id: string;
    subscriptionStatus: string;
    plan: { code: string };
  }
): Promise<void> {
  const client = getPostHogClient();
  identifyOrchestrator(client, userId, {
    team_id: team.id,
    plan_code: team.plan.code,
    subscription_status: team.subscriptionStatus,
  });
  await client.shutdown();
}

export function captureServerEvent(
  client: PostHogLike,
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  groups?: { team?: string }
): void {
  client.capture({
    distinctId,
    event,
    properties,
    groups,
  });
}
