import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo/site';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Join Room',
  description: 'Join a synchronized screen light room as a guest and sync your screen to the rave.',
  alternates: { canonical: '/join' },
});

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-zinc-950 text-white">{children}</div>;
}
