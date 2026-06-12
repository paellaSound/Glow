import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

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

export default nextConfig;
