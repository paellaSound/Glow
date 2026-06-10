import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isVercel = process.env.VERCEL === '1';
const monorepoRoot = isVercel ? projectRoot : path.resolve(projectRoot, '..');

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
