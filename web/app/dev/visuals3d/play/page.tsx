/**
 * Server wrapper for the 3D player. Unwraps the (Promise) searchParams here so
 * the client component receives a plain scene id — avoids the Next 15/16
 * sync-dynamic-apis warning that fires when a client page enumerates the
 * searchParams Promise directly.
 */

import PlayerClient from './player-client';

export default async function Visuals3DPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const { scene } = await searchParams;
  return <PlayerClient sceneId={scene ?? null} />;
}
