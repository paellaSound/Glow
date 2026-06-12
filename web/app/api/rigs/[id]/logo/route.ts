import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

export async function POST(
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
    if (!entitlements.customRigLogo) {
      return NextResponse.json(
        { error: 'Custom rig logo requires a Venue plan or higher' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Size limit: 256KB
    if (file.size > 256 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 256KB limit' }, { status: 400 });
    }

    // MIME type validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PNG, JPEG, WEBP, SVG, GIF.' },
        { status: 400 }
      );
    }

    // Clean file extension
    const ext = file.name.split('.').pop() || 'png';
    const cleanExt = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext.toLowerCase())
      ? ext.toLowerCase()
      : 'png';
    const filename = `${id}_${Date.now()}.${cleanExt}`;
    const storagePath = `${user.id}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('rig-logos')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Update logo in DB
    const [updatedRig] = await db
      .update(rigs)
      .set({
        logoAssetPath: storagePath,
        logoEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(rigs.id, id))
      .returning();

    return NextResponse.json(updatedRig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to upload logo' }, { status: 500 });
  }
}
