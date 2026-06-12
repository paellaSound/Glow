import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope, Syne, Space_Grotesk } from 'next/font/google';
import { getProfile, getTeamForUser } from '@/lib/db/queries';
import { ThemeProvider } from '@/components/theme-provider';
import { PostHogIdentify } from '@/components/posthog-identify';
import { buildMarketingMetadata, SITE_NAME } from '@/lib/seo/site';
import { SWRConfig } from 'swr';

export const metadata: Metadata = buildMarketingMetadata({
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
});

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-cyber',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${syne.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-[100dvh] bg-background text-foreground font-sans">
        <ThemeProvider>
          <PostHogIdentify />
          <SWRConfig
            value={{
              fallback: {
                '/api/user': getProfile(),
                '/api/team': getTeamForUser(),
              },
            }}
          >
            {children}
          </SWRConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}

