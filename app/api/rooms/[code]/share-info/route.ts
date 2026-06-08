import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { roomSessions } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * GET /api/rooms/[code]/share-info
 *
 * Public endpoint used by the fullscreen QR page to show rig branding
 * (name + enabled social links) for the active room session.
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
      return NextResponse.json({ rigName: null, socials: [], adsEnabled: true });
    }

    return NextResponse.json({
      rigName: session.rig?.name ?? null,
      socials: session.rig?.socials.map((social) => ({
        kind: social.kind,
        label: social.label,
        url: social.url,
        enabled: social.enabled,
        sortOrder: social.sortOrder,
      })) ?? [],
      adsEnabled: session.adsEnabledSnapshot,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load share info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
