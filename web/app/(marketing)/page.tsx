import type { Metadata } from 'next';
import Link from 'next/link';
import { NeonButton, Tooltip } from '@/components/ui/neon';
import { HelpCircle } from 'lucide-react';
import { HomePageJsonLd } from '@/lib/seo/json-ld';
import {
  buildMarketingMetadata,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from '@/lib/seo/site';

export const metadata: Metadata = buildMarketingMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
});

const CTAS = [
  {
    href: '/room/new',
    label: 'Glow Your Rave',
    color: 'magenta' as const,
    variant: 'solid' as const,
    tooltipTitle: 'HOST A RAVE',
    tooltip:
      'Sign in, create a rave, and run the show from this device. Share a QR or link — synced lights, live visuals, polls, raffles, and crowd reactions from one desk.',
    hint: 'Sign in · create rave · share QR · lights, visuals & crowd tools',
  },
  {
    href: '/join',
    label: 'Sync Your Screen',
    color: 'cyan' as const,
    variant: 'outline' as const,
    tooltipTitle: 'JOIN AS A LIGHT',
    tooltip:
      'Guest path — no account needed. Enter the rave code or open the host’s link. This screen becomes a synced light in the crowd.',
    hint: 'Join to a rave · No signup · enter code or link · device becomes a synced light',
  },
  {
    href: '/standalone',
    label: 'Solo Beam',
    color: 'violet' as const,
    variant: 'outline' as const,
    tooltipTitle: 'TRY PRESETS LOCALLY',
    tooltip:
      'Run strobe, pulse, and audio-reactive presets on this screen only. No rave, no host — useful for testing colors before the moment goes live.',
    hint: 'Single screen · test presets · no rave required',
  },
] as const;

const STEPS = [
  {
    color: 'magenta' as const,
    title: 'Host the show',
    body: 'Sign in, create a rave, and share the QR or link. From one desk you run synced lights, launch live polls, run raffles, and push reactions to the crowd.',
  },
  {
    color: 'cyan' as const,
    title: 'Connect the crowd',
    body: 'Guests open your link on their phones — no app install, no account. Every screen flashes in sync as unified washes or cells in a spatial matrix.',
  },
  {
    color: 'violet' as const,
    title: 'Light the rave',
    body: 'Drive a projector or TV with live visuals, shaders, and art from the Visuals tab while phones stay your handheld floor lights — rave, meetup, or festival, one connected moment.',
  },
] as const;

const stepBadgeClass = {
  magenta: 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20',
  cyan: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  violet: 'bg-neon-violet/10 text-neon-violet border-neon-violet/20',
} as const;

export default function HomePage() {
  return (
    <>
      <HomePageJsonLd />

      <main className="mx-auto max-w-6xl w-full p-6 my-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 lg:gap-16">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1 text-xs font-cyber tracking-widest text-neon-cyan uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan"></span>
              </span>
              Real-time connector · No app install
            </div>

            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[0.95] text-foreground uppercase">
              Sync lights across
              <span className="block text-neon-magenta neon-text-magenta mt-1">
                every screen
              </span>
            </h1>

            <div className="max-w-xl text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
              {SITE_NAME} connects the rave — synced device lights, live visuals on the big screen,
              polls, raffles, and crowd reactions. Whether it&apos;s a rave, a meeting, or a
              festival moment, one host runs the show; everyone else joins via link or QR in the{' '}
              browser
              <Tooltip
                color="cyan"
                title="How it works"
                content={
                  <div className="space-y-2.5 text-zinc-300">
                    <p className="text-[10px] leading-relaxed text-zinc-400">
                      One host, many phones, one optional big screen — lights, visuals, and crowd tools kept
                      in sync through {SITE_NAME}.
                    </p>
                    <ol className="space-y-2 list-none">
                      {STEPS.map((step, index) => (
                        <li key={step.title} className="flex items-start gap-2">
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold border ${stepBadgeClass[step.color]}`}>
                            {index + 1}
                          </span>
                          <span className="text-[10px]">
                            <span className="font-bold text-zinc-200">{step.title}:</span>{' '}
                            {step.body}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                }
                panelClassName="w-72 sm:w-80"
              >
                <span className="pb-4 inline-flex items-center justify-center align-middle ml-1.5 cursor-help text-neon-cyan hover:text-white transition-colors">
                  <HelpCircle className="size-4" />
                </span>
              </Tooltip>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 w-full sm:grid-cols-3 lg:grid-cols-1 lg:max-w-xs shrink-0 pt-2">
            {CTAS.map((cta) => (
              <div key={cta.href} className="flex flex-col gap-2 w-[60%]">
                {/* Mobile: static info card with button inside */}
                <div className={`sm:hidden rounded-xl border bg-card/60 backdrop-blur-md p-3.5 flex flex-col gap-3 ${cta.color === 'magenta'
                  ? 'border-neon-magenta/20'
                  : cta.color === 'cyan'
                    ? 'border-neon-cyan/20'
                    : 'border-neon-violet/20'
                  }`}>
                  <div>
                    <p className={`font-cyber uppercase tracking-widest text-[9px] font-bold mb-1 ${cta.color === 'magenta'
                      ? 'text-neon-magenta'
                      : cta.color === 'cyan'
                        ? 'text-neon-cyan'
                        : 'text-neon-violet'
                      }`}>
                      {cta.tooltipTitle}
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {cta.tooltip}
                    </p>
                  </div>
                  <Link href={cta.href} className="w-full">
                    <NeonButton
                      color={cta.color}
                      variant={cta.variant}
                      className="w-full text-sm uppercase tracking-wider h-11 px-6 justify-center"
                    >
                      {cta.label}
                    </NeonButton>
                  </Link>
                </div>

                {/* sm+: tooltip on hover */}
                <div className="hidden sm:block w-full">
                  <Tooltip color={cta.color} title={cta.tooltipTitle} content={cta.tooltip} className="w-full block">
                    <Link href={cta.href} className="w-full block">
                      <NeonButton
                        color={cta.color}
                        variant={cta.variant}
                        className="w-full text-sm uppercase tracking-wider h-11 px-6 justify-center"
                      >
                        {cta.label}
                      </NeonButton>
                    </Link>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
