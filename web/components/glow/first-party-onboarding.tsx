'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@/lib/onboarding/constants';
import { trackOnboardingStepCompleted } from '@/lib/onboarding/analytics';
import {
  persistChecklistDismissStatus,
  useOnboardingVisibility,
} from '@/lib/onboarding/use-onboarding-person-state';
import { OnboardingSpotlight } from '@/components/glow/onboarding-spotlight';

type FirstPartyOnboardingProps = {
  roomCode: string;
  deviceCount: number;
  hasRunPreset: boolean;
  visualsTabActive: boolean;
  shareAcknowledged?: boolean;
  onRequestVisualsTab?: () => void;
  onActiveStepChange?: (step: OnboardingStepId | null) => void;
};

export function FirstPartyOnboarding({
  roomCode,
  deviceCount,
  hasRunPreset,
  visualsTabActive,
  shareAcknowledged = false,
  onRequestVisualsTab,
  onActiveStepChange,
}: FirstPartyOnboardingProps) {
  const { ready, visible: shouldShow, initialCompletedSteps } = useOnboardingVisibility();
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepId>>(() => new Set());
  const [dismissed, setDismissed] = useState(false);
  const trackedSteps = useRef<Set<OnboardingStepId>>(new Set());
  const hydratedFromPostHog = useRef(false);

  useEffect(() => {
    if (!ready || hydratedFromPostHog.current) return;
    hydratedFromPostHog.current = true;
    if (initialCompletedSteps.size > 0) {
      setCompletedSteps(new Set(initialCompletedSteps));
      initialCompletedSteps.forEach((step) => trackedSteps.current.add(step));
    }
  }, [ready, initialCompletedSteps]);

  const markStepComplete = useCallback(
    (step: OnboardingStepId) => {
      setCompletedSteps((prev) => {
        if (prev.has(step)) return prev;
        const next = new Set(prev);
        next.add(step);
        return next;
      });

      if (!trackedSteps.current.has(step)) {
        trackedSteps.current.add(step);
        trackOnboardingStepCompleted(step, roomCode, {
          deviceCount: step === 2 ? deviceCount : undefined,
        });
      }
    },
    [roomCode, deviceCount]
  );

  useEffect(() => {
    if (shareAcknowledged) {
      markStepComplete(1);
    }
  }, [shareAcknowledged, markStepComplete]);

  useEffect(() => {
    if (visualsTabActive) {
      markStepComplete(4);
    }
  }, [visualsTabActive, markStepComplete]);

  const activeStep = useMemo((): OnboardingStepId | null => {
    for (const step of ONBOARDING_STEPS) {
      if (!completedSteps.has(step.id)) return step.id;
    }
    return null;
  }, [completedSteps]);

  useEffect(() => {
    onActiveStepChange?.(ready && shouldShow && !dismissed ? activeStep : null);
  }, [activeStep, onActiveStepChange, ready, shouldShow, dismissed]);

  useEffect(() => {
    if (!ready || !shouldShow || dismissed || activeStep !== null) return;
    persistChecklistDismissStatus('complete');
    setDismissed(true);
    onActiveStepChange?.(null);
  }, [activeStep, ready, shouldShow, dismissed, onActiveStepChange]);

  function dismiss(status: 'complete' | 'dismissed') {
    persistChecklistDismissStatus(status);
    setDismissed(true);
    onActiveStepChange?.(null);
  }

  function handleStepContinue(step: OnboardingStepId) {
    markStepComplete(step);
  }

  function handleOpenVisuals() {
    onRequestVisualsTab?.();
  }

  if (!ready || !shouldShow || dismissed) return null;

  if (activeStep === null) return null;

  return (
    <OnboardingSpotlight
      activeStep={activeStep}
      enabled
      deviceCount={deviceCount}
      hasRunPreset={hasRunPreset}
      onContinueStep={handleStepContinue}
      onOpenVisuals={handleOpenVisuals}
      onFinishTour={() => dismiss('complete')}
      onDismissTour={() => dismiss('dismissed')}
    />
  );
}
