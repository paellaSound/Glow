import Link from 'next/link';
import { NeonButton, Tooltip } from '@/components/ui/neon';
import { HelpCircle } from 'lucide-react';

const CTAS = [
  {
    href: '/room/new',
    label: 'Glow Your Rave',
    color: 'magenta' as const,
    variant: 'solid' as const,
    tooltipTitle: 'HOST A ROOM',
    tooltip:
      'Sign in, create a room, and control the show from this device. Share a QR or link, send live patterns, and optionally drive a projector from the Visuals tab.',
    hint: 'Sign in · create room · share QR · control patterns & Visuals',
  },
  {
    href: '/join',
    label: 'Sync Your Screen',
    color: 'cyan' as const,
    variant: 'outline' as const,
    tooltipTitle: 'JOIN AS A LIGHT',
    tooltip:
      'Guest path — no account needed. Enter the room code or open the host’s link. This screen becomes a synced floor light in the party.',
    hint: 'No signup · enter code or link · phone becomes a synced light',
  },
  {
    href: '/standalone',
    label: 'Solo Beam',
    color: 'violet' as const,
    variant: 'outline' as const,
    tooltipTitle: 'TRY PRESETS LOCALLY',
    tooltip:
      'Run strobe, pulse, and audio-reactive presets on this screen only. No room, no host — useful for testing colors before a party.',
    hint: 'Single screen · test presets · no room required',
  },
] as const;

const STEPS = [
  {
    color: 'magenta' as const,
    title: 'Host the show',
    body: 'Sign in on your main device, tap Glow Your Rave, and share the QR or link. You run the lighting desk — patterns, torch, and media.',
  },
  {
    color: 'cyan' as const,
    title: 'Fill the floor',
    body: 'Guests open your link on their phones — no app install, no account. Every screen flashes in sync, unified or as cells in a grid matrix.',
  },
  {
    color: 'violet' as const,
    title: 'Add the stage (optional)',
    body: 'Open Visuals on the control desk to drive a projector or TV with shaders and art, while phones stay your handheld floor lights.',
  },
] as const;

const stepBadgeClass = {
  magenta: 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20',
  cyan: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  violet: 'bg-neon-violet/10 text-neon-violet border-neon-violet/20',
} as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-6 py-20 md:py-28 space-y-12">
      <div className="max-w-3xl space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1 text-xs font-cyber tracking-widest text-neon-cyan uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan"></span>
          </span>
          No app install · Guests join with a code
        </div>

        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[0.95] text-foreground uppercase">
          Sync lights across
          <span className="block text-neon-magenta neon-text-magenta mt-1">
            every screen
          </span>
        </h1>

        <p className="max-w-xl text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
          Turn phones into synchronized rave lights — and optionally drive a projector from the same
          desk. You host with one account; guests join via link or QR. Patterns, audio-reactive
          effects, and a grid matrix when you want spatial waves.
        </p>

        <div className="pt-2 grid gap-6 sm:grid-cols-3 sm:gap-4 max-w-3xl">
          {CTAS.map((cta) => (
            <div key={cta.href} className="flex flex-col items-center gap-2 sm:items-start">
              <Tooltip color={cta.color} title={cta.tooltipTitle} content={cta.tooltip}>
                <Link href={cta.href} className="w-full">
                  <NeonButton
                    color={cta.color}
                    variant={cta.variant}
                    className="w-full text-sm uppercase tracking-wider h-11 px-6"
                  >
                    {cta.label}
                  </NeonButton>
                </Link>
              </Tooltip>
              <p className="text-[11px] leading-snug text-muted-foreground text-center sm:text-left px-1">
                {cta.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border dark:border-white/5 bg-card/40 backdrop-blur-md rounded-2xl p-6 max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-neon-cyan neon-text-cyan" />
          <span className="font-cyber text-xs uppercase tracking-widest text-foreground font-bold">
            How it works
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          One host, many phones, one optional big screen — all kept in sync through Glow.
        </p>
        <ul className="text-xs space-y-3 text-zinc-600 dark:text-zinc-400 font-sans">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${stepBadgeClass[step.color]}`}
              >
                {index + 1}
              </span>
              <span>
                <strong>{step.title}:</strong> {step.body}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
