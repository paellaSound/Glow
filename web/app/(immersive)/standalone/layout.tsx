import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo/site';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Solo Beam',
  description: 'Run audio-reactive strobe, pulse, and local light presets on this screen only.',
  alternates: { canonical: '/standalone' },
});

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
