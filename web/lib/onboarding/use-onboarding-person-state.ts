'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { OnboardingStepId } from '@/lib/onboarding/constants';
import {
  ONBOARDING_STORAGE_KEY,
  PH_FIRST_DEVICE_KEY,
  PH_FIRST_PRESET_KEY,
} from '@/lib/onboarding/constants';
import { markChecklistPersonStatus } from '@/lib/onboarding/analytics';
import {
  readOnboardingPersonState,
  waitForPostHogPersonReady,
} from '@/lib/onboarding/person-properties';
import {
  persistOnboardingStatus,
  shouldShowOnboarding as shouldShowOnboardingLocal,
} from '@/lib/onboarding/storage';
import { parseOnboardingUrl } from '@/lib/onboarding/url';
import { isPostHogEnabled } from '@/lib/posthog-config';

type OnboardingVisibilityState = {
  ready: boolean;
  visible: boolean;
  forcedByUrl: boolean;
  initialCompletedSteps: Set<OnboardingStepId>;
  refresh: () => void;
};

export function useOnboardingVisibility(): OnboardingVisibilityState {
  const searchParams = useSearchParams();
  const urlIntent = useMemo(() => parseOnboardingUrl(searchParams), [searchParams]);

  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [forcedByUrl, setForcedByUrl] = useState(false);
  const [initialCompletedSteps, setInitialCompletedSteps] = useState<Set<OnboardingStepId>>(
    () => new Set()
  );

  useEffect(() => {
    if (urlIntent.type !== 'reset-local') return;
    if (typeof window === 'undefined') return;

    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(PH_FIRST_DEVICE_KEY);
    localStorage.removeItem(PH_FIRST_PRESET_KEY);
  }, [urlIntent.type]);

  const sync = useCallback(() => {
    const forceShow = urlIntent.type === 'show';

    if (!isPostHogEnabled()) {
      setForcedByUrl(forceShow);
      setVisible(forceShow || shouldShowOnboardingLocal());
      setInitialCompletedSteps(new Set());
      setReady(true);
      return;
    }

    const state = readOnboardingPersonState();
    setInitialCompletedSteps(state.completedSteps);
    setForcedByUrl(forceShow);
    // First login: checklist props are null → shouldShowChecklist true.
    // URL force bypasses complete/dismissed for debugging.
    setVisible(forceShow || state.shouldShowChecklist);
    setReady(true);
  }, [urlIntent.type]);

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

  return { ready, visible, forcedByUrl, initialCompletedSteps, refresh: sync };
}

export function persistChecklistDismissStatus(status: 'complete' | 'dismissed'): void {
  persistOnboardingStatus(status);

  if (isPostHogEnabled()) {
    markChecklistPersonStatus(status);
  }
}
