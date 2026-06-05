import { NextRequest, NextResponse } from 'next/server';
import { recordAdImpression, getTeamForUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const team = await getTeamForUser();

  await recordAdImpression({
    teamId: team?.id,
    viewerType: body.viewerType,
    placement: body.placement,
    metadata: body.metadata ?? {},
  });

  return NextResponse.json({ ok: true });
}
