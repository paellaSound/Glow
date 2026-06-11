import Link from 'next/link';
import { MarketingHeader } from '@/components/glow/marketing-header';
import { PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-x-hidden">
      <SectionGlow glowColor="mixed" position="top" />
      
      <MarketingHeader />

      <PageTransitionWrapper className="flex flex-1 flex-col pb-12">
        {children}
      </PageTransitionWrapper>
      
      <footer className="border-t border-border/40 bg-background/20 backdrop-blur-md py-6 mt-auto">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between px-6 gap-4 text-[10px] sm:text-xs text-muted-foreground font-sans">
          <div className="font-cyber uppercase tracking-wider text-center sm:text-left">
            &copy; {new Date().getFullYear()} Glow. All rights reserved. Created by Luis Millán.
          </div>
          <div className="flex gap-6 font-cyber uppercase tracking-widest">
            <Link href="/privacy" className="hover:text-neon-cyan hover:neon-text-cyan transition-all duration-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-neon-magenta hover:neon-text-magenta transition-all duration-300">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
