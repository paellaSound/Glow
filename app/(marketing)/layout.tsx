import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserAccountMenu } from '@/components/glow/user-account-menu';
import { Sparkles } from 'lucide-react';
import { PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-x-hidden">
      <SectionGlow glowColor="mixed" position="top" />
      
      <header className="border-b border-border/40 bg-background/40 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 group">
            <Sparkles className="size-5 text-neon-cyan transition-transform group-hover:rotate-12 duration-500" />
            <span className="text-xl font-display font-extrabold uppercase tracking-widest text-neon-cyan neon-text-cyan neon-flicker">
              GLOW
            </span>
            <span className="text-[10px] font-cyber tracking-widest text-neon-magenta uppercase ml-1 opacity-90">
              THE RAVE
            </span>
          </Link>
          <Link href="/billing">
            <Button variant="ghost" className="hover:text-neon-cyan hover:neon-text-cyan text-xs">
              Billing
            </Button>
          </Link>
        </div>
      </header>

      <PageTransitionWrapper className="flex flex-1 flex-col">
        {children}
      </PageTransitionWrapper>
      
      <UserAccountMenu />
    </div>
  );
}
