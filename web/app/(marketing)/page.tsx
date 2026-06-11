import Link from 'next/link';
import { NeonButton, NeonTitle, Tooltip } from '@/components/ui/neon';
import { HelpCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-6 py-20 md:py-28 space-y-12">
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

        <div className="pt-4 flex flex-col gap-4 sm:flex-row items-center">
          <Tooltip color="magenta" title="ORCHESTRATE RAVE" content="Launch a synced rave room. This device acts as the main control desk. (At least 2 screens recommended!)">
            <Link href="/room/new" className="w-full sm:w-auto">
              <NeonButton color="magenta" variant="solid" className="w-full text-sm uppercase tracking-wider h-11 px-8">
                Glow Your Rave
              </NeonButton>
            </Link>
          </Tooltip>

          <Tooltip color="cyan" title="JOIN THE GRID" content="Enter a room code to sync this screen. It will light up in perfect synchronization with the room conductor.">
            <Link href="/join" className="w-full sm:w-auto">
              <NeonButton color="cyan" variant="outline" className="w-full text-sm uppercase tracking-wider h-11 px-8">
                Sync Your Screen
              </NeonButton>
            </Link>
          </Tooltip>

          <Tooltip color="violet" title="SOLO BEAM" content="Run presets locally on this single screen. Great for testing colors and flash rates on your own.">
            <Link href="/standalone" className="w-full sm:w-auto">
              <NeonButton color="violet" variant="outline" className="w-full text-sm uppercase tracking-wider h-11 px-8">
                Solo Beam
              </NeonButton>
            </Link>
          </Tooltip>
        </div>
      </div>

      {/* Quick Help Guide HUD Panel */}
      <div className="border border-border dark:border-white/5 bg-card/40 backdrop-blur-md rounded-2xl p-6 max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-neon-cyan neon-text-cyan" />
          <span className="font-cyber text-xs uppercase tracking-widest text-foreground font-bold">Rave Guide & Setup</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          How to synchronize your screens for the ultimate electronic music visual experience:
        </p>
        <ul className="text-xs space-y-3 text-zinc-600 dark:text-zinc-400 font-sans">
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-magenta/10 text-[10px] font-bold text-neon-magenta border border-neon-magenta/20">1</span>
            <span><strong>Grab 2+ Screens:</strong> Place multiple smartphones, tablets, or laptops next to each other (minimum 2 screens needed to start a synced rave).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-cyan/10 text-[10px] font-bold text-neon-cyan border border-neon-cyan/20">2</span>
            <span><strong>Glow Your Rave:</strong> Launch a room on your main device. It becomes the lighting desk console.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-violet/10 text-[10px] font-bold text-neon-violet border border-neon-violet/20">3</span>
            <span><strong>Sync Screens:</strong> Open <strong>Sync Your Screen</strong> on your other screens, enter the code, place them in the grid matrix, and control the frequency!</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
