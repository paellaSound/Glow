import { NextResponse } from 'next/server';
import { getProfile, getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ user: null, team: null });
  }

  const team = await getTeamForUser();
  const entitlements = team ? await getTeamEntitlements(team.id) : null;

  return NextResponse.json({
    user: profile,
    team,
    entitlements,
  });
}
