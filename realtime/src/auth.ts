import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAuthKey, getSupabaseUrl, getVisualsTokenSecret } from './env.js';

let supabase: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabase) {
    supabase = createClient(getSupabaseUrl(), getSupabaseAuthKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}

export async function validateAccessToken(token: string) {
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Verify a visuals surface token produced by POST /api/rooms/[code]/visuals-token.
 *
 * Token format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256 signature)
 * Payload: { roomCode, sessionId, scope: 'visuals', exp: unixSeconds }
 *
 * Returns the decoded payload if valid, null otherwise.
 */
export function verifyVisualsToken(
  token: string,
  expectedRoomCode: string,
): { roomCode: string; sessionId: string; scope: string; exp: number } | null {
  const secret = getVisualsTokenSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  // Constant-time HMAC verification
  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  try {
    const sigBuf = Buffer.from(sigB64, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  // Decode payload
  let payload: { roomCode: string; sessionId: string; scope: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as typeof payload;
  } catch {
    return null;
  }

  if (
    payload.scope !== 'visuals' ||
    payload.roomCode?.toUpperCase() !== expectedRoomCode.toUpperCase() ||
    typeof payload.exp !== 'number' ||
    Date.now() / 1000 > payload.exp
  ) {
    return null;
  }

  return payload;
}
