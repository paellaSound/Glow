import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { patternSequences } from '@/lib/db/schema';
import { getTeamEntitlements } from '@/lib/entitlements';
import { getTeamForUser } from '@/lib/db/queries';
import {
  validateEffects,
  validatePalette,
  type PatternSequenceDraft,
} from '@/lib/glow/pattern-sequences';

function serializeSequence(row: typeof patternSequences.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    palette: row.palette as string[],
    effects: row.effects,
    media: row.media,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const row = await db.query.patternSequences.findFirst({
      where: and(eq(patternSequences.id, id), eq(patternSequences.ownerUserId, user.id)),
    });

    if (!row) {
      return NextResponse.json({ error: 'Pattern sequence not found' }, { status: 404 });
    }

    return NextResponse.json(serializeSequence(row));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get pattern sequence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await db.query.patternSequences.findFirst({
      where: and(eq(patternSequences.id, id), eq(patternSequences.ownerUserId, user.id)),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pattern sequence not found' }, { status: 404 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 404 });
    }

    const entitlements = await getTeamEntitlements(team.id);
    const body = (await req.json()) as Partial<PatternSequenceDraft>;

    if (body.palette !== undefined && !validatePalette(body.palette)) {
      return NextResponse.json({ error: 'Palette must have 1–12 valid hex colors' }, { status: 400 });
    }

    if (
      body.effects !== undefined &&
      !validateEffects(body.effects, entitlements.effectLayering)
    ) {
      return NextResponse.json(
        { error: 'Invalid effects configuration or multi-effect not allowed on your plan' },
        { status: 400 }
      );
    }

    if (body.isDefault === true) {
      await db
        .update(patternSequences)
        .set({ isDefault: false })
        .where(eq(patternSequences.ownerUserId, user.id));
    }

    const [updated] = await db
      .update(patternSequences)
      .set({
        name: body.name !== undefined ? body.name : undefined,
        palette: body.palette !== undefined ? body.palette : undefined,
        effects: body.effects !== undefined ? body.effects : undefined,
        media: body.media !== undefined ? body.media : undefined,
        isDefault: body.isDefault !== undefined ? body.isDefault : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(patternSequences.id, id), eq(patternSequences.ownerUserId, user.id)))
      .returning();

    return NextResponse.json(serializeSequence(updated!));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update pattern sequence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await db
      .delete(patternSequences)
      .where(and(eq(patternSequences.id, id), eq(patternSequences.ownerUserId, user.id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Pattern sequence not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete pattern sequence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
