import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '20';

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Klipy search failed' }, { status: 500 });
  }
}
