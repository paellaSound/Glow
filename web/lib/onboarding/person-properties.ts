import posthog from 'posthog-js';
import { isPostHogEnabled } from '@/lib/posthog-config';
import type { OnboardingStepId } from '@/lib/onboarding/constants';
import { getOnboardingStatus } from '@/lib/onboarding/storage';

/**
 * Person property keys — must match boolean fields defined in PostHog (project 200710).
 * Per-step completion + milestone flags + checklist lifecycle.
 */
export const ONBOARDING_PERSON_PROPS = {
  checklistComplete: 'onboarding_checklist_complete',
  checklistDismissed: 'onboarding_checklist_dismissed',
  firstDeviceConnected: 'first_device_connected',
  firstPresetRun: 'first_preset_run',
} as const;

export function stepPersonProp(step: OnboardingStepId): string {
  return `onboarding_step_${step}_completed`;
}

export function getPersonProp(key: string): boolean | null {
  if (!isPostHogEnabled()) return null;
  const value = posthog.get_property(key);
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

/** Merge person properties without clearing existing traits (team_id, plan_code, …). */
export function setPersonProps(props: Record<string, boolean>): void {
  if (!isPostHogEnabled()) return;

  if (typeof posthog.setPersonProperties === 'function') {
    posthog.setPersonProperties(props);
    return;
  }

  const distinctId = posthog.get_distinct_id();
  if (distinctId) {
    posthog.identify(distinctId, props);
  }
}

export function setPersonPropIfUnset(key: string, value: boolean): boolean {
  if (getPersonProp(key) === true) return false;
  setPersonProps({ [key]: value });
  return true;
}

export type OnboardingPersonState = {
  completedSteps: Set<OnboardingStepId>;
  checklistComplete: boolean;
  checklistDismissed: boolean;
  firstDeviceConnected: boolean;
  firstPresetRun: boolean;
  shouldShowChecklist: boolean;
};

export function readOnboardingPersonState(): OnboardingPersonState {
  const completedSteps = new Set<OnboardingStepId>();

  for (const step of [1, 2, 3, 4] as OnboardingStepId[]) {
    if (getPersonProp(stepPersonProp(step)) === true) {
      completedSteps.add(step);
    }
  }

  const checklistComplete =
    getPersonProp(ONBOARDING_PERSON_PROPS.checklistComplete) === true;
  const checklistDismissed =
    getPersonProp(ONBOARDING_PERSON_PROPS.checklistDismissed) === true;
  const firstDeviceConnected =
    getPersonProp(ONBOARDING_PERSON_PROPS.firstDeviceConnected) === true;
  const firstPresetRun =
    getPersonProp(ONBOARDING_PERSON_PROPS.firstPresetRun) === true;

  return {
    completedSteps,
    checklistComplete,
    checklistDismissed,
    firstDeviceConnected,
    firstPresetRun,
    // Show when user never finished or dismissed. Step props being null is OK — checklist starts at step 1.
    shouldShowChecklist: !checklistComplete && !checklistDismissed,
  };
}

export function persistChecklistStatus(status: 'complete' | 'dismissed'): void {
  const key =
    status === 'complete'
      ? ONBOARDING_PERSON_PROPS.checklistComplete
      : ONBOARDING_PERSON_PROPS.checklistDismissed;
  setPersonProps({ [key]: true });
}

export function getOnboardingDebugSnapshot() {
  const posthogEnabled = isPostHogEnabled();
  const personProps: Record<string, boolean | null | string> = {};

  for (const step of [1, 2, 3, 4] as OnboardingStepId[]) {
    personProps[stepPersonProp(step)] = posthogEnabled
      ? getPersonProp(stepPersonProp(step))
      : null;
  }

  for (const value of Object.values(ONBOARDING_PERSON_PROPS)) {
    personProps[value] = posthogEnabled ? getPersonProp(value) : null;
  }

  if (posthogEnabled) {
    personProps['$distinct_id'] = posthog.get_distinct_id();
  }

  const state = posthogEnabled ? readOnboardingPersonState() : null;
  const shouldShowChecklist = posthogEnabled
    ? (state?.shouldShowChecklist ?? null)
    : getOnboardingStatus() === null;

  return {
    posthogEnabled,
    personProps,
    state,
    completedSteps: state ? [...state.completedSteps] : [],
    shouldShowChecklist,
  };
}

export function waitForPostHogPersonReady(): Promise<void> {
  if (!isPostHogEnabled()) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    posthog.onFeatureFlags(finish);
    window.setTimeout(finish, 1500);
  });
}
