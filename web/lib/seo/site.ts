import type { Metadata } from 'next';

/** Public site origin — set BASE_URL in production (e.g. https://glow.app). */
export function getSiteUrl(): string {
  const base =
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://glowtherave.com';
  return base.replace(/\/$/, '');
}

export const SITE_NAME = 'Glow';

/** Short brand line used in titles and OG. */
export const SITE_TAGLINE =
  'Real-time connector suite for raves, meetings & festivals';

/** Longer descriptor for meta descriptions and JSON-LD. */
export const SITE_DESCRIPTION =
  'Connect every screen in the room — synced device lights, live visuals on the big screen, polls, raffles, and crowd reactions. One host runs the show; guests join in the browser, no app install.';

export const OG_IMAGE_PATH = '/logo-wide.png';

export const OG_IMAGE_ALT =
  'Glow — neon waveform logo for synced lights and live event connectivity';

export function buildOpenGraphImage() {
  const siteUrl = getSiteUrl();
  return {
    url: `${siteUrl}${OG_IMAGE_PATH}`,
    width: 1200,
    height: 630,
    alt: OG_IMAGE_ALT,
  };
}

/** Shared marketing metadata — extended by route-level exports. */
export function buildMarketingMetadata(overrides?: Partial<Metadata>): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = buildOpenGraphImage();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${SITE_NAME} — ${SITE_TAGLINE}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
      'Glow',
      'sync device lights',
      'rave lighting',
      'live event visuals',
      'crowd connectivity',
      'live polls',
      'raffle',
      'projector visuals',
      'no app install',
      'QR room join',
    ],
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [ogImage.url],
    },
    ...overrides,
  };
}
