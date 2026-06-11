import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// Vercel Root Directory is `web/` inside the monorepo; parent is the workspace root.
const monorepoRoot = path.resolve(projectRoot, '..');

const nextConfig: NextConfig = {
  transpilePackages: ['glow-presets', 'glow-visuals'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    ppr: true,
    clientSegmentCache: true
  }
};

export default nextConfig;
