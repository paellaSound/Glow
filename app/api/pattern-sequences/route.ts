import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { patternSequences } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';
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
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.query.patternSequences.findMany({
      where: eq(patternSequences.ownerUserId, user.id),
      orderBy: (seq, { desc }) => [desc(seq.updatedAt)],
    });

    return NextResponse.json(rows.map(serializeSequence));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list pattern sequences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 404 });
    }

    const entitlements = await getTeamEntitlements(team.id);
    const maxSequences = entitlements.maxPatternSequences;

    const [countResult] = await db
      .select({ value: sql<number>`count(*)` })
      .from(patternSequences)
      .where(eq(patternSequences.ownerUserId, user.id));

    const currentCount = Number(countResult?.value ?? 0);
    if (currentCount >= maxSequences) {
      return NextResponse.json(
        { error: `Pattern sequence limit reached. Your plan allows up to ${maxSequences}.` },
        { status: 403 }
      );
    }

    const body = (await req.json()) as PatternSequenceDraft;
    const { name, palette, effects, isDefault } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!validatePalette(palette)) {
      return NextResponse.json({ error: 'Palette must have 1–12 valid hex colors' }, { status: 400 });
    }

    if (!validateEffects(effects, entitlements.effectLayering)) {
      return NextResponse.json(
        { error: 'Invalid effects configuration or multi-effect not allowed on your plan' },
        { status: 400 }
      );
    }

    if (isDefault) {
      await db
        .update(patternSequences)
        .set({ isDefault: false })
        .where(eq(patternSequences.ownerUserId, user.id));
    }

    const [created] = await db
      .insert(patternSequences)
      .values({
        ownerUserId: user.id,
        teamId: team.id,
        name,
        palette,
        effects,
        isDefault: isDefault ?? false,
      })
      .returning();

    return NextResponse.json(serializeSequence(created!));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create pattern sequence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
