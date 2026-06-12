import { getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';
import type { GifSearchMode } from '@/lib/glow/types';

export async function getTeamGifSearchMode(): Promise<GifSearchMode> {
  const team = await getTeamForUser();
  if (!team) return 'featured_page1';
  const entitlements = await getTeamEntitlements(team.id);
  return entitlements.gifSearchMode ?? 'featured_page1';
}
