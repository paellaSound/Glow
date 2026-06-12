/** localStorage fallback when PostHog is disabled (dev default) */
export const ONBOARDING_STORAGE_KEY = 'glow_onboarding_v1';

export type OnboardingStorageValue = 'complete' | 'dismissed';

/** localStorage once-per-browser fallback when PostHog is disabled */
export const PH_FIRST_DEVICE_KEY = 'glow_ph_first_device';
export const PH_FIRST_PRESET_KEY = 'glow_ph_first_preset';

/** Empty until AI onboarding video is ready */
export const ONBOARDING_VIDEO_URL = '';

export const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Share QR or link',
    description: 'Tap Share or View QR so guests can join from their phones.',
    target: 'share' as const,
  },
  {
    id: 2,
    title: 'Connect first phone',
    description: 'Waiting for a guest to open the link and join the room.',
    target: 'devices' as const,
  },
  {
    id: 3,
    title: 'Run your first preset',
    description: 'Pick a pattern sequence and tap Send Live.',
    target: 'preset' as const,
  },
  {
    id: 4,
    title: 'Open Visuals (optional)',
    description: 'Set up a projector or TV with the Visuals tab.',
    target: 'visuals' as const,
    optional: true,
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];
