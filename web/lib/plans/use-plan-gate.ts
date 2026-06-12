'use client';

import { useMemo } from 'react';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import type { PlanEntitlements } from '@/lib/glow/types';
import {
  buildLimitBody,
  buildLimitTitle,
  deriveGateState,
  getRequiredPlanForFeature,
  type GateFeature,
  type PlanGateState,
  type PlanCode,
} from './plan-meta';

export type UsePlanGateOptions = {
  state?: PlanGateState;
  limitReason?: string;
  requiredPlan?: PlanCode;
  roomEntitlements?: PlanEntitlements | null;
  deviceCount?: number;
  matrixCells?: number;
  rows?: number;
  cols?: number;
};

export function usePlanGate(feature: GateFeature, options: UsePlanGateOptions = {}) {
  const { teamEntitlements, team, loading } = useTeamEntitlements();

  const entitlements = useMemo(
    () => mergeEntitlementsForUi(options.roomEntitlements, teamEntitlements),
    [options.roomEntitlements, teamEntitlements]
  );

  const requiredPlan = (options.requiredPlan ?? getRequiredPlanForFeature(feature)) as Exclude<
    PlanCode,
    'free'
  >;

  const derivedState =
    options.state ??
    deriveGateState(feature, entitlements, {
      deviceCount: options.deviceCount,
      matrixCells: options.matrixCells,
    });

  const limitReason =
    options.limitReason ??
    buildLimitTitle(feature, {
      deviceCount: options.deviceCount,
      matrixCells: options.matrixCells,
      rows: options.rows,
      cols: options.cols,
    });

  const limitBody = buildLimitBody(feature, requiredPlan);

  const hasActiveSubscription =
    team?.subscriptionStatus === 'active' || team?.subscriptionStatus === 'trialing';

  return {
    feature,
    state: derivedState,
    entitlements,
    requiredPlan,
    limitReason,
    limitBody,
    hasActiveSubscription,
    loading,
  };
}
