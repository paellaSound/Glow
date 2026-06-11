'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { User } from 'lucide-react';
import { GlowBrandLockup } from '@/components/glow/glow-brand-lockup';
import { OngoingSessionIndicator } from '@/components/glow/ongoing-session-banner';
import { ThemeToggle } from '@/components/glow/theme-toggle';
import { UserAccountMenu } from '@/components/glow/user-account-menu';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type UserApiResponse = {
  user: {
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

export function MarketingHeader() {
  const { data } = useSWR<UserApiResponse>('/api/user', fetcher);

  return (
    <header className="border-b border-border/40 bg-background/40 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <GlowBrandLockup />

        <div className="flex items-center gap-2">
          <OngoingSessionIndicator />
          <ThemeToggle />
          {data?.user ? (
            <UserAccountMenu variant="inline" />
          ) : (
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-neon-cyan hover:neon-text-cyan"
            >
              <User className="size-3.5 opacity-70" aria-hidden />
              Account
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
