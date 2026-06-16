import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import { withPostHogConfig } from '@posthog/nextjs-config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// Monorepo root (Glow/). Required for pnpm workspace tracing and Turbopack.
const monorepoRoot = path.resolve(projectRoot, '..');

const nextConfig: NextConfig = {
  transpilePackages: ['glow-presets', 'glow-visuals', 'glow-visuals-3d'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    ppr: true,
    clientSegmentCache: true
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://eu-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

const sourcemapsEnabled = Boolean(
  process.env.POSTHOG_PERSONAL_API_KEY &&
    process.env.POSTHOG_PROJECT_ID &&
    process.env.NODE_ENV === 'production'
);

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? 'disabled',
  projectId: process.env.POSTHOG_PROJECT_ID ?? '200710',
  host: 'https://eu.posthog.com',
  sourcemaps: {
    enabled: sourcemapsEnabled,
    deleteAfterUpload: true,
  },
});
