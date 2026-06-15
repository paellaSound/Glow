import type { Metadata } from 'next';
import Link from 'next/link';
import { NeonButton, Tooltip } from '@/components/ui/neon';
import { HelpCircle } from 'lucide-react';
import { buildHomePageJsonLd } from '@/lib/seo/json-ld';
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
    tooltipTitle: 'HOST A ROOM',
    tooltip:
      'Sign in, create a room, and run the show from this device. Share a QR or link — synced lights, live visuals, polls, raffles, and crowd reactions from one desk.',
    hint: 'Sign in · create room · share QR · lights, visuals & crowd tools',
  },
  {
    href: '/join',
    label: 'Sync Your Screen',
    color: 'cyan' as const,
    variant: 'outline' as const,
    tooltipTitle: 'JOIN AS A LIGHT',
    tooltip:
      'Guest path — no account needed. Enter the room code or open the host’s link. This screen becomes a synced light in the crowd.',
    hint: 'No signup · enter code or link · device becomes a synced light',
  },
  {
    href: '/standalone',
    label: 'Solo Beam',
    color: 'violet' as const,
    variant: 'outline' as const,
    tooltipTitle: 'TRY PRESETS LOCALLY',
    tooltip:
      'Run strobe, pulse, and audio-reactive presets on this screen only. No room, no host — useful for testing colors before the moment goes live.',
    hint: 'Single screen · test presets · no room required',
  },
] as const;

const STEPS = [
  {
    color: 'magenta' as const,
    title: 'Host the show',
    body: 'Sign in, create a room, and share the QR or link. From one desk you run synced lights, launch live polls, run raffles, and push reactions to the crowd.',
  },
  {
    color: 'cyan' as const,
    title: 'Connect the crowd',
    body: 'Guests open your link on their phones — no app install, no account. Every screen flashes in sync as unified washes or cells in a spatial matrix.',
  },
  {
    color: 'violet' as const,
    title: 'Light the room',
    body: 'Drive a projector or TV with live visuals, shaders, and art from the Visuals tab while phones stay your handheld floor lights — rave, meetup, or festival, one connected moment.',
  },
] as const;

const stepBadgeClass = {
  magenta: 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20',
  cyan: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  violet: 'bg-neon-violet/10 text-neon-violet border-neon-violet/20',
} as const;

export default function HomePage() {
  const jsonLd = buildHomePageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-6 py-20 md:py-28 space-y-12">
        <div className="max-w-3xl space-y-8">
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

          <p className="max-w-xl text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
            {SITE_NAME} connects the room — synced device lights, live visuals on the big screen,
            polls, raffles, and crowd reactions. Whether it&apos;s a rave, a meeting, or a
            festival moment, one host runs the show; everyone else joins via link or QR in the
            browser.
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

        <section
          aria-labelledby="how-it-works-heading"
          className="border border-border dark:border-white/5 bg-card/40 backdrop-blur-md rounded-2xl p-6 max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-neon-cyan neon-text-cyan" aria-hidden />
            <h2
              id="how-it-works-heading"
              className="font-cyber text-xs uppercase tracking-widest text-foreground font-bold"
            >
              How it works
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            One host, many phones, one optional big screen — lights, visuals, and crowd tools kept
            in sync through {SITE_NAME}.
          </p>
          <ol className="text-xs space-y-3 text-zinc-600 dark:text-zinc-400 font-sans list-none">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${stepBadgeClass[step.color]}`}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span>
                  <h3 className="inline font-bold">{step.title}:</h3>{' '}
                  {step.body}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
