import { NextResponse } from 'next/server';
import { getGlowIceConfigServer } from '@/lib/glow/ice-servers-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getGlowIceConfigServer();
  const hasTurn = config.iceServers.some((server) => {
    const urls = server.urls;
    const list = Array.isArray(urls) ? urls : [urls];
    return list.some((url) => typeof url === 'string' && url.startsWith('turn'));
  });

  return NextResponse.json(
    {
      iceServers: config.iceServers,
      iceTransportPolicy: config.iceTransportPolicy,
      hasTurn,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
