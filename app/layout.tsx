import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope, Syne, Space_Grotesk } from 'next/font/google';
import { getProfile, getTeamForUser } from '@/lib/db/queries';
import { ThemeProvider } from '@/components/theme-provider';
import { SWRConfig } from 'swr';

export const metadata: Metadata = {
  title: 'Glow — Sync lights across every screen',
  description: 'Create rooms, place devices in a matrix, and control colors in real time.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Glow',
  },
};

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

