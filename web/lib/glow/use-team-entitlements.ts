'use client';

import useSWR from 'swr';
import type { PlanEntitlements } from './types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type UserApiResponse = {
  entitlements: PlanEntitlements | null;
  team: {
    id: string;
    subscriptionStatus: string;
    planId: string;
    stripeCustomerId: string | null;
  } | null;
};

export function useTeamEntitlements() {
  const { data, isLoading, mutate } = useSWR<UserApiResponse>('/api/user', fetcher, {
    revalidateOnFocus: true,
  });

  return {
    teamEntitlements: data?.entitlements ?? null,
    team: data?.team ?? null,
    loading: isLoading,
    mutate,
  };
}
