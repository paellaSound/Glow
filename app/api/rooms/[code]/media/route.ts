import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { db } from '@/lib/db/drizzle';
import { roomSessions, roomMediaAssets } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check room session
    const session = await db.query.roomSessions.findFirst({
      where: and(eq(roomSessions.roomCode, roomCode), isNull(roomSessions.endedAt)),
      orderBy: (s, { desc }) => [desc(s.startedAt)],
    });

    if (!session) {
      return NextResponse.json({ error: 'Active room session not found' }, { status: 404 });
    }

    if (session.orchestratorUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized: Not the VJ orchestrator' }, { status: 403 });
    }

    // Check entitlements
    const entitlements = session.entitlementsSnapshot as any;
    if (!entitlements || !entitlements.customMediaUpload) {
      return NextResponse.json({ error: 'Plan upgrade required for custom media upload' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Size limit check (1 MB = 1_048_576 bytes)
    if (file.size > 1048576) {
      return NextResponse.json({ error: 'File size exceeds 1 MB limit' }, { status: 400 });
    }

    // MIME type check
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PNG, JPEG, WEBP, and GIF are allowed' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Storage provider not configured' }, { status: 500 });
    }

    // Ensure room-media bucket exists
    const { data: buckets } = await adminClient.storage.listBuckets();
    if (!buckets?.some((b) => b.id === 'room-media')) {
      const { error: bucketCreateError } = await adminClient.storage.createBucket('room-media', {
        public: true,
        fileSizeLimit: 1048576,
        allowedMimeTypes: allowedMimes,
      });

      if (bucketCreateError) {
        return NextResponse.json({ error: 'Failed to initialize storage bucket' }, { status: 500 });
      }
    }

    const fileId = crypto.randomUUID();
    const extension = file.name.split('.').pop() || 'png';
    const storagePath = `${session.id}/${fileId}.${extension}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from('room-media')
      .upload(storagePath, Buffer.from(buffer), {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage.from('room-media').getPublicUrl(storagePath);

    // Save to database
    const [asset] = await db
      .insert(roomMediaAssets)
      .values({
        roomSessionId: session.id,
        teamId: session.teamId,
        storagePath: storagePath,
        mime: file.type,
        bytes: file.size,
      })
      .returning();

    return NextResponse.json({ url: publicUrl, assetId: asset.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Media upload failed' }, { status: 500 });
  }
}
