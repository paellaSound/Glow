import posthog from 'posthog-js';
import type { OrchestratorTraits } from '@/lib/posthog-analytics';

export function applyOrchestratorIdentify(userId: string, traits: OrchestratorTraits): void {
  posthog.identify(userId, traits);
  posthog.group('team', traits.team_id, {
    plan_code: traits.plan_code,
    subscription_status: traits.subscription_status,
  });
}

export type TeamApiShape = {
  id: string;
  subscriptionStatus: string;
  plan: { code: string };
};

export function traitsFromTeam(team: TeamApiShape): OrchestratorTraits {
  return {
    team_id: team.id,
    plan_code: team.plan.code,
    subscription_status: team.subscriptionStatus,
  };
}
