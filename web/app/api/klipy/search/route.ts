import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';
import { getTeamGifSearchMode } from '@/lib/klipy/entitlements';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const perPage = searchParams.get('per_page') || '20';

  const gifSearchMode = await getTeamGifSearchMode();
  const page = gifSearchMode === 'featured_page1' ? 1 : requestedPage;
  if (gifSearchMode === 'featured_page1' && requestedPage > 1) {
    return NextResponse.json(
      { error: 'featured_page1_only', message: 'Upgrade to Venue for full GIF search' },
      { status: 403 }
    );
  }

  const appKey = process.env.KLIPY_APP_KEY || 'test_key';
  const customerId = crypto.createHash('md5').update(user.id).digest('hex');

  try {
    const url = `https://api.klipy.com/api/v1/${appKey}/gifs/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&customer_id=${customerId}&content_filter=safe`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to search GIFs from Klipy' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Klipy search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
