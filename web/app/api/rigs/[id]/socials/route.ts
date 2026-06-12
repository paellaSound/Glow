import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs, rigSocials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

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

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const entitlements = await getTeamEntitlements(team.id);

    const body = await req.json();
    const { socials } = body;

    if (!Array.isArray(socials)) {
      return NextResponse.json({ error: 'socials must be an array' }, { status: 400 });
    }

    if (!entitlements.customQrBranding && socials.length > 0) {
      return NextResponse.json(
        { error: 'Custom QR social links require a Venue plan or higher' },
        { status: 403 }
      );
    }

    // Atomically replace all socials
    const insertedSocials = await db.transaction(async (tx) => {
      // 1. Delete all existing socials
      await tx.delete(rigSocials).where(eq(rigSocials.rigId, id));

      // 2. Insert new socials if array not empty
      if (socials.length > 0) {
        return tx
          .insert(rigSocials)
          .values(
            socials.map((social: any, idx: number) => ({
              rigId: id,
              kind: social.kind,
              label: social.label || null,
              url: social.url,
              enabled: social.enabled ?? true,
              sortOrder: idx,
            }))
          )
          .returning();
      }

      return [];
    });

    return NextResponse.json(insertedSocials);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to replace socials' }, { status: 500 });
  }
}
