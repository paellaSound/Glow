import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs, rigCues } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership of the rig
    const rig = await db.query.rigs.findFirst({
      where: and(eq(rigs.id, id), eq(rigs.ownerUserId, user.id)),
    });

    if (!rig) {
      return NextResponse.json({ error: 'Rig not found or not owned by user' }, { status: 404 });
    }

    const body = await req.json();
    const { cues } = body; // Array of cue objects

    if (!Array.isArray(cues)) {
      return NextResponse.json({ error: 'cues must be an array' }, { status: 400 });
    }

    // Atomically replace all cues
    const insertedCues = await db.transaction(async (tx) => {
      // 1. Delete all existing cues
      await tx.delete(rigCues).where(eq(rigCues.rigId, id));

      // 2. Insert new cues if array not empty
      if (cues.length > 0) {
        return tx
          .insert(rigCues)
          .values(
            cues.map((cue: any, idx: number) => ({
              rigId: id,
              visualArtId: cue.visualArtId,
              sortOrder: idx,
              params: cue.params || null,
              transition: cue.transition || null,
              label: cue.label || null,
            }))
          )
          .returning();
      }

      return [];
    });

    return NextResponse.json(insertedCues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to replace cues' }, { status: 500 });
  }
}
