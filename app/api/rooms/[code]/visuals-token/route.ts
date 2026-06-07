import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { roomSessions } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const TOKEN_TTL_SECONDS = 6 * 60 * 60; // 6 hours

function getVisualsTokenSecret() {
  return process.env.VISUALS_TOKEN_SECRET ?? '';
}

/**
 * Sign a visuals token.
 *
 * Format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256)
 * This matches the verifyVisualsToken() implementation in realtime/src/auth.ts.
 */
function signVisualsToken(payload: {
  roomCode: string;
  sessionId: string;
  scope: 'visuals';
  exp: number;
}): string {
  const secret = getVisualsTokenSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * POST /api/rooms/[code]/visuals-token
 *
 * Mints a short-lived visuals surface token for the authenticated orchestrator.
 * The token is passed to /room/[code]/visuals#token=<jwt> so the surface can
 * authenticate with the realtime service on any machine.
 *
 * Response:
 *   { url: string, token: string, expiresAt: string (ISO) }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  // 1. Verify Supabase session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check VISUALS_TOKEN_SECRET is configured
  const secret = getVisualsTokenSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'Visuals token signing is not configured on this server.' },
      { status: 503 },
    );
  }

  // 3. Find an active room session owned by this user for this room code
  const sessions = await db
    .select({
      id: roomSessions.id,
      endedAt: roomSessions.endedAt,
    })
    .from(roomSessions)
    .where(
      and(
        eq(roomSessions.roomCode, roomCode),
        eq(roomSessions.orchestratorUserId, user.id),
        isNull(roomSessions.endedAt),
      ),
    )
    .limit(1);

  if (sessions.length === 0) {
    return NextResponse.json(
      { error: 'No active room session found for this room code.' },
      { status: 404 },
    );
  }

  const session = sessions[0];

  // 4. Sign token
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SECONDS;
  const payload = {
    roomCode,
    sessionId: session.id,
    scope: 'visuals' as const,
    exp,
  };

  const token = signVisualsToken(payload);
  const expiresAt = new Date(exp * 1000).toISOString();

  // Token goes in the fragment so it is never sent to servers / logged.
  const baseUrl = process.env.BASE_URL ?? '';
  const url = `${baseUrl}/room/${roomCode}/visuals#token=${token}`;

  return NextResponse.json({ url, token, expiresAt });
}
