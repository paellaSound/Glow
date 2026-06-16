import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs, roomSessions } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const rigWith = {
  cues: { orderBy: (c: any, { asc }: any) => [asc(c.sortOrder)] },
  socials: { orderBy: (s: any, { asc }: any) => [asc(s.sortOrder)] },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  const roomCode = code.toUpperCase();

  try {
    const session = await db.query.roomSessions.findFirst({
      where: and(
        eq(roomSessions.roomCode, roomCode),
        eq(roomSessions.orchestratorUserId, user.id),
        isNull(roomSessions.endedAt)
      ),
      orderBy: (s, { desc }) => [desc(s.startedAt)],
    });

    const rig = session?.rigId
      ? await db.query.rigs.findFirst({
          where: and(eq(rigs.id, session.rigId), eq(rigs.ownerUserId, user.id)),
          with: rigWith,
        })
      : await db.query.rigs.findFirst({
          where: and(eq(rigs.ownerUserId, user.id), eq(rigs.isDefault, true)),
          with: rigWith,
        });

    return NextResponse.json(rig ?? null);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get rig' },
      { status: 500 }
    );
  }
}
