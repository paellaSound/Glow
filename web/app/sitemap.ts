import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/site';

const PUBLIC_ROUTES: MetadataRoute.Sitemap = [
  { url: '/', changeFrequency: 'weekly', priority: 1 },
  { url: '/join', changeFrequency: 'monthly', priority: 0.9 },
  { url: '/standalone', changeFrequency: 'monthly', priority: 0.7 },
  { url: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { url: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return PUBLIC_ROUTES.map((entry) => ({
    ...entry,
    url: `${siteUrl}${entry.url}`,
  }));
}
