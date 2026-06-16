'use client';

import { GlowBrandLockup } from '@/components/glow/glow-brand-lockup';
import { OngoingSessionIndicator } from '@/components/glow/ongoing-session-banner';
// import { ThemeToggle } from '@/components/glow/theme-toggle';
import { UserAccountMenu } from '@/components/glow/user-account-menu';

export function MarketingHeader() {
  return (
    <header className="border-b border-border/40 bg-background/40 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
      <div className=" flex w-full items-center justify-between px-6 py-4">
        <GlowBrandLockup />

        <div className="flex items-center gap-2">
          <OngoingSessionIndicator />
          {/* <ThemeToggle /> */}
          <UserAccountMenu variant="inline" />
        </div>
      </div>
    </header>
  );
}

