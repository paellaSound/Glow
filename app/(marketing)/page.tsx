import Link from 'next/link';
import { NeonButton, NeonTitle } from '@/components/ui/neon';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-6 py-24 md:py-32">
      <div className="max-w-3xl space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1 text-xs font-cyber tracking-widest text-neon-cyan uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan"></span>
          </span>
          System Online · Frequency Sync
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[0.95] text-foreground uppercase">
          Sync lights across
          <span className="block text-neon-magenta neon-text-magenta mt-1">
            every screen
          </span>
        </h1>

        <p className="max-w-xl text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
          Transform your environment into an electronic canvas. Create a room, arrange your screens in a tactile matrix, and dictate colors like a live club lighting desk.
        </p>

        <div className="pt-4 flex flex-col gap-4 sm:flex-row">
          <Link href="/room/new">
            <NeonButton color="magenta" variant="solid" className="w-full sm:w-auto text-sm uppercase tracking-wider h-11 px-8">
              Create Room
            </NeonButton>
          </Link>
          <Link href="/join">
            <NeonButton color="cyan" variant="outline" className="w-full sm:w-auto text-sm uppercase tracking-wider h-11 px-8">
              Join Room
            </NeonButton>
          </Link>
          <Link href="/standalone">
            <NeonButton color="violet" variant="outline" className="w-full sm:w-auto text-sm uppercase tracking-wider h-11 px-8">
              Standalone
            </NeonButton>
          </Link>
        </div>
      </div>
    </main>
  );
}
