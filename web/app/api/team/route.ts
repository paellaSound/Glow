import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

export async function GET() {
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ team: null, entitlements: null });
  }

  const entitlements = await getTeamEntitlements(team.id);

  return NextResponse.json({ team, entitlements });
}
