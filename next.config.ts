import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['glow-presets'],
  experimental: {
    ppr: true,
    clientSegmentCache: true
  }
};

export default nextConfig;
