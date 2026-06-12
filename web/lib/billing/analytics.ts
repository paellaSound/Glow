import { captureClientEvent } from '@/lib/posthog-client';
import type { GateFeature, PlanCode } from '@/lib/plans/plan-meta';

export type BillingUpgradeModalTrigger =
  | 'overlay'
  | 'banner'
  | 'limited'
  | 'upsell';

type UpgradeModalAnalyticsContext = {
  feature: GateFeature;
  requiredPlan: Exclude<PlanCode, 'free'>;
  trigger: BillingUpgradeModalTrigger;
};

export function trackBillingUpgradeModalShown({
  feature,
  requiredPlan,
  trigger,
}: UpgradeModalAnalyticsContext) {
  captureClientEvent('billing_upgrade_modal_shown', {
    feature,
    required_plan: requiredPlan,
    trigger,
  });
}

export function trackBillingUpgradeModalDismissed({
  feature,
  requiredPlan,
}: Omit<UpgradeModalAnalyticsContext, 'trigger'>) {
  captureClientEvent('billing_upgrade_modal_dismissed', {
    feature,
    required_plan: requiredPlan,
  });
}

export function trackBillingPageViewed(currentPlanCode: string) {
  captureClientEvent('billing_page_viewed', {
    current_plan_code: currentPlanCode,
  });
}
