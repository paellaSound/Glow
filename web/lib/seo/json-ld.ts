import React from 'react';
import {
  getSiteUrl,
  OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from './site';

export function buildHomePageJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'en',
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}${OG_IMAGE_PATH}`,
      },
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}/#app`,
        name: SITE_NAME,
        url: siteUrl,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript. Modern mobile or desktop browser.',
        description: SITE_DESCRIPTION,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free tier with optional paid plans for larger events.',
        },
        featureList: [
          'Synchronized device lights and matrix grid',
          'Live visuals for projectors and TVs',
          'Live polls and audience reactions',
          'Raffles and crowd engagement',
          'Audio-reactive presets and pattern sequences',
          'Guest join via QR or link — no app install',
        ],
        slogan: SITE_TAGLINE,
      },
    ],
  };
}

export function JsonLd({ data }: { data: Record<string, any> }) {
  return React.createElement('script', {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  });
}

export function HomePageJsonLd() {
  return React.createElement(JsonLd, { data: buildHomePageJsonLd() });
}

