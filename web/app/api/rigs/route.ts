import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userRigs = await db.query.rigs.findMany({
      where: eq(rigs.ownerUserId, user.id),
      with: {
        cues: {
          orderBy: (cue, { asc }) => [asc(cue.sortOrder)],
        },
        socials: {
          orderBy: (social, { asc }) => [asc(social.sortOrder)],
        },
      },
      orderBy: (r, { desc }) => [desc(r.updatedAt)],
    });

    return NextResponse.json(userRigs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list rigs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 404 });
    }

    const entitlements = await getTeamEntitlements(team.id);
    const maxRigs = entitlements.maxRigs;

    const [rigCountResult] = await db
      .select({ value: sql<number>`count(*)` })
      .from(rigs)
      .where(eq(rigs.ownerUserId, user.id));

    const currentRigCount = Number(rigCountResult?.value ?? 0);
    if (currentRigCount >= maxRigs) {
      return NextResponse.json(
        { error: `Rig limit reached. Your plan allows up to ${maxRigs} rigs.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      defaultVisualArtId,
      palette,
      logoAssetPath,
      logoEnabled,
      consoleConfig,
      metadata,
      isDefault,
    } = body;

    // Validate palette length (1-4 hex colors)
    if (palette && (!Array.isArray(palette) || palette.length < 1 || palette.length > 4)) {
      return NextResponse.json({ error: 'Palette must have between 1 and 4 colors' }, { status: 400 });
    }

    // Enforce only one isDefault per user
    if (isDefault) {
      await db.update(rigs).set({ isDefault: false }).where(eq(rigs.ownerUserId, user.id));
    }

    // Insert rig
    const [newRig] = await db
      .insert(rigs)
      .values({
        ownerUserId: user.id,
        teamId: team.id,
        name: name || 'Unnamed Rig',
        defaultVisualArtId: defaultVisualArtId || 'audio-shader',
        palette: palette || ['#FF0055', '#00FFCC'],
        logoAssetPath: logoAssetPath || null,
        logoEnabled: logoEnabled ?? false,
        consoleConfig: consoleConfig || {},
        metadata: metadata || {},
        isDefault: isDefault ?? false,
      })
      .returning();

    return NextResponse.json(newRig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create rig' }, { status: 500 });
  }
}
