import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rig = await db.query.rigs.findFirst({
      where: and(eq(rigs.id, id), eq(rigs.ownerUserId, user.id)),
      with: {
        cues: {
          orderBy: (cue, { asc }) => [asc(cue.sortOrder)],
        },
        socials: {
          orderBy: (social, { asc }) => [asc(social.sortOrder)],
        },
      },
    });

    if (!rig) {
      return NextResponse.json({ error: 'Rig not found' }, { status: 404 });
    }

    return NextResponse.json(rig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get rig' }, { status: 500 });
  }
}

export async function PATCH(
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
    // Verify ownership
    const rigExists = await db.query.rigs.findFirst({
      where: and(eq(rigs.id, id), eq(rigs.ownerUserId, user.id)),
    });

    if (!rigExists) {
      return NextResponse.json({ error: 'Rig not found or not owned by user' }, { status: 404 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const entitlements = await getTeamEntitlements(team.id);

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

    const patch: Record<string, unknown> = {
      name: name !== undefined ? name : undefined,
      defaultVisualArtId: defaultVisualArtId !== undefined ? defaultVisualArtId : undefined,
      palette: palette !== undefined ? palette : undefined,
      consoleConfig: consoleConfig !== undefined ? consoleConfig : undefined,
      metadata: metadata !== undefined ? metadata : undefined,
      isDefault: isDefault !== undefined ? isDefault : undefined,
      updatedAt: new Date(),
    };

    if (entitlements.customRigLogo) {
      if (logoAssetPath !== undefined) patch.logoAssetPath = logoAssetPath;
      if (logoEnabled !== undefined) patch.logoEnabled = logoEnabled;
    } else if (logoEnabled === false) {
      patch.logoEnabled = false;
    } else if (logoAssetPath !== undefined || logoEnabled === true) {
      return NextResponse.json(
        { error: 'Custom rig logo requires a Venue plan or higher' },
        { status: 403 }
      );
    }

    // Validate palette length (1-4 hex colors)
    if (palette && (!Array.isArray(palette) || palette.length < 1 || palette.length > 4)) {
      return NextResponse.json({ error: 'Palette must have between 1 and 4 colors' }, { status: 400 });
    }

    // Enforce only one isDefault per user
    if (isDefault === true) {
      await db.update(rigs).set({ isDefault: false }).where(eq(rigs.ownerUserId, user.id));
    }

    // Update
    const updatePayload = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );

    const [updatedRig] = await db
      .update(rigs)
      .set(updatePayload)
      .where(and(eq(rigs.id, id), eq(rigs.ownerUserId, user.id)))
      .returning();

    return NextResponse.json(updatedRig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update rig' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Delete rig (cues and socials cascade delete because of references)
    const result = await db
      .delete(rigs)
      .where(and(eq(rigs.id, id), eq(rigs.ownerUserId, user.id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Rig not found or not owned by user' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete rig' }, { status: 500 });
  }
}
