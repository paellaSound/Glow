import { NextResponse } from 'next/server';
import { getActiveRoomForUser, getAuthUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeRoom = await getActiveRoomForUser(user.id);
  return NextResponse.json(activeRoom);
}
