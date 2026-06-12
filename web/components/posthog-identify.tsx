'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { isPostHogEnabled } from '@/lib/posthog-config';
import { applyOrchestratorIdentify, traitsFromTeam } from '@/lib/posthog-identify-traits';

type TeamApiResponse = {
  team: {
    id: string;
    subscriptionStatus: string;
    plan: { code: string };
  } | null;
};

const teamFetcher = (url: string) => fetch(url).then((res) => res.json());

const ORCHESTRATOR_REPLAY_PATTERN =
  /^\/(billing|room\/new|room\/[^/]+\/control)(\/|$)/;

function syncSessionReplay(pathname: string): void {
  if (!isPostHogEnabled()) return;

  if (ORCHESTRATOR_REPLAY_PATTERN.test(pathname)) {
    posthog.startSessionRecording();
  } else {
    posthog.stopSessionRecording();
  }
}

export function PostHogIdentify() {
  const pathname = usePathname();
  const { data: teamData } = useSWR<TeamApiResponse>(
    isPostHogEnabled() ? '/api/team' : null,
    teamFetcher
  );

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    syncSessionReplay(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isPostHogEnabled()) return;

    const supabase = createClient();

    async function identifyUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (teamData?.team) {
        applyOrchestratorIdentify(user.id, traitsFromTeam(teamData.team));
      } else {
        posthog.identify(user.id);
      }
    }

    void identifyUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (teamData?.team) {
          applyOrchestratorIdentify(session.user.id, traitsFromTeam(teamData.team));
        } else {
          posthog.identify(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        posthog.reset();
        posthog.stopSessionRecording();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [teamData?.team]);

  return null;
}
