import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { roomSessions } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import { parsePlayerChromeConfig } from '@/lib/glow/player-chrome-config';
import type { PlanEntitlements } from '@/lib/glow/types';

/**
 * GET /api/rooms/[code]/share-info
 *
 * Public endpoint used by QR / share UI for active room branding.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  try {
    const session = await db.query.roomSessions.findFirst({
      where: and(eq(roomSessions.roomCode, roomCode), isNull(roomSessions.endedAt)),
      with: {
        rig: {
          with: {
            socials: {
              orderBy: (social, { asc }) => [asc(social.sortOrder)],
            },
          },
        },
      },
      orderBy: (session, { desc }) => [desc(session.startedAt)],
    });

    if (!session) {
      return NextResponse.json({
        rigName: null,
        socials: [],
        adsEnabled: true,
        customQrBranding: false,
        glowBrandName: GLOW_BRAND_NAME,
        playerChrome: {},
        logoAssetPath: null,
        customRigLogo: false,
        removeWatermark: false,
        entitlements: {},
      });
    }

    const entitlements = (session.entitlementsSnapshot ?? {}) as PlanEntitlements;
    const customQrBranding = Boolean(entitlements?.customQrBranding);
    const consoleConfig = (session.rig?.consoleConfig ?? {}) as Record<string, unknown>;
    const socials = customQrBranding
      ? (session.rig?.socials.map((social) => ({
          kind: social.kind,
          label: social.label,
          url: social.url,
          enabled: social.enabled,
          sortOrder: social.sortOrder,
        })) ?? [])
      : [];

    return NextResponse.json({
      rigName: customQrBranding ? (session.rig?.name ?? null) : null,
      socials,
      adsEnabled: session.adsEnabledSnapshot,
      customQrBranding,
      glowBrandName: GLOW_BRAND_NAME,
      playerChrome: parsePlayerChromeConfig(consoleConfig.playerChrome),
      logoAssetPath: session.rig?.logoAssetPath ?? null,
      customRigLogo: Boolean(entitlements?.customRigLogo),
      removeWatermark: Boolean(entitlements?.removeWatermark),
      entitlements,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load share info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
