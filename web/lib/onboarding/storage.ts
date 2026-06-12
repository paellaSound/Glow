import {
  ONBOARDING_STORAGE_KEY,
  type OnboardingStorageValue,
} from '@/lib/onboarding/constants';

export function getOnboardingStatus(): OnboardingStorageValue | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (value === 'complete' || value === 'dismissed') return value;
  return null;
}

export function shouldShowOnboarding(): boolean {
  return getOnboardingStatus() === null;
}

export function persistOnboardingStatus(value: OnboardingStorageValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, value);
}

export function hasPostHogOnceFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(key) === '1';
}

export function setPostHogOnceFlag(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, '1');
}
