import { NextResponse } from 'next/server';

/**
 * Server-side YouTube metadata lookup (title + thumbnail) via the public
 * oEmbed endpoint — no API key required, avoids CORS on the client.
 *
 * GET /api/youtube/oembed?id=<videoId>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  if (!/^[\w-]{11}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_video_id' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return NextResponse.json({
      videoId: id,
      title: data.title ?? null,
      author: data.author_name ?? null,
      thumbnail: data.thumbnail_url ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 });
  }
}
