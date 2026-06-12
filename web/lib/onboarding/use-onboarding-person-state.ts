'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OnboardingStepId } from '@/lib/onboarding/constants';
import { markChecklistPersonStatus } from '@/lib/onboarding/analytics';
import {
  readOnboardingPersonState,
  waitForPostHogPersonReady,
} from '@/lib/onboarding/person-properties';
import {
  persistOnboardingStatus,
  shouldShowOnboarding as shouldShowOnboardingLocal,
} from '@/lib/onboarding/storage';
import { isPostHogEnabled } from '@/lib/posthog-config';

type OnboardingVisibilityState = {
  ready: boolean;
  visible: boolean;
  initialCompletedSteps: Set<OnboardingStepId>;
  refresh: () => void;
};

export function useOnboardingVisibility(): OnboardingVisibilityState {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [initialCompletedSteps, setInitialCompletedSteps] = useState<Set<OnboardingStepId>>(
    () => new Set()
  );

  const sync = useCallback(() => {
    if (!isPostHogEnabled()) {
      setVisible(shouldShowOnboardingLocal());
      setInitialCompletedSteps(new Set());
      setReady(true);
      return;
    }

    const state = readOnboardingPersonState();
    setInitialCompletedSteps(state.completedSteps);
    setVisible(state.shouldShowChecklist);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isPostHogEnabled()) {
        await waitForPostHogPersonReady();
      }
      if (!cancelled) sync();
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sync]);

  return { ready, visible, initialCompletedSteps, refresh: sync };
}

export function persistChecklistDismissStatus(status: 'complete' | 'dismissed'): void {
  persistOnboardingStatus(status);

  if (isPostHogEnabled()) {
    markChecklistPersonStatus(status);
  }
}
