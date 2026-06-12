import { captureClientEvent } from '@/lib/posthog-client';
import type { OnboardingStepId } from '@/lib/onboarding/constants';
import {
  getPersonProp,
  ONBOARDING_PERSON_PROPS,
  setPersonPropIfUnset,
  setPersonProps,
  stepPersonProp,
} from '@/lib/onboarding/person-properties';
import { isPostHogEnabled } from '@/lib/posthog-config';
import { hasPostHogOnceFlag, setPostHogOnceFlag } from '@/lib/onboarding/storage';
import {
  PH_FIRST_DEVICE_KEY,
  PH_FIRST_PRESET_KEY,
} from '@/lib/onboarding/constants';

function shouldCaptureOnceEvent(
  personPropKey: string,
  localStorageKey: string
): boolean {
  if (isPostHogEnabled()) {
    return getPersonProp(personPropKey) !== true;
  }
  if (hasPostHogOnceFlag(localStorageKey)) return false;
  setPostHogOnceFlag(localStorageKey);
  return true;
}

export function trackOnboardingStepCompleted(
  step: OnboardingStepId,
  roomCode: string,
  options?: { deviceCount?: number }
): void {
  captureClientEvent('onboarding_step_completed', {
    step,
    room_code: roomCode.toUpperCase(),
  });

  setPersonPropIfUnset(stepPersonProp(step), true);

  if (step === 2 && options?.deviceCount !== undefined) {
    trackFirstDeviceConnected(roomCode, options.deviceCount);
  }

  if (step === 3) {
    trackFirstPresetRun(roomCode);
  }
}

export function trackFirstDeviceConnected(roomCode: string, deviceCount: number): void {
  const shouldCapture = shouldCaptureOnceEvent(
    ONBOARDING_PERSON_PROPS.firstDeviceConnected,
    PH_FIRST_DEVICE_KEY
  );

  setPersonPropIfUnset(ONBOARDING_PERSON_PROPS.firstDeviceConnected, true);

  if (!shouldCapture) return;

  captureClientEvent('first_device_connected', {
    room_code: roomCode.toUpperCase(),
    device_count: deviceCount,
  });
}

export function trackFirstPresetRun(roomCode: string): void {
  const shouldCapture = shouldCaptureOnceEvent(
    ONBOARDING_PERSON_PROPS.firstPresetRun,
    PH_FIRST_PRESET_KEY
  );

  setPersonPropIfUnset(ONBOARDING_PERSON_PROPS.firstPresetRun, true);

  if (!shouldCapture) return;

  captureClientEvent('first_preset_run', {
    room_code: roomCode.toUpperCase(),
  });
}

export function markChecklistPersonStatus(status: 'complete' | 'dismissed'): void {
  const key =
    status === 'complete'
      ? ONBOARDING_PERSON_PROPS.checklistComplete
      : ONBOARDING_PERSON_PROPS.checklistDismissed;
  setPersonProps({ [key]: true });
}
